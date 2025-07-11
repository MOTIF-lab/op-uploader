process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const Minio = require('minio');
const { safeAwait } = require('./utils');
 
const app = express();

const minioClient = new Minio.Client({
    endPoint:  process.env.MINIO_HOST || 'nas.motiflab.net',
    port: parseInt(process.env.MINIO_PORT || 443),
    useSSL: true,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
})
 
app.use(morgan('combined'))
 
app.get('/', (req, res) => {
    res.send('OK')
});

app.get('/v1.1/devices/:dongle_id/', async (req, res) => {
    const { dongle_id } = req.params;
    res.json({
        is_paired: true,
        prime_type: 5,
    })
});

app.get('/v1.4/:dongle_id/upload_url/', async (req, res) => {
    const { dongle_id } = req.params;
    const file_path = req.query.path;
    const real_ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (!file_path) {
        return res.status(400).json({
            error: 'file_path query parameter is required'
        });
    }
    const fn_path = decodeURIComponent(file_path);
    let obj_path = '';
    if (file_path.startsWith('boot') || file_path.startsWith('crash')) {
        // Handle special cases for boot and crash files
        const fn_path_split = fn_path.match(/^(boot|crash)\/(.*)$/);
        if (!fn_path_split) {
            return res.status(400).json({
                error: 'Invalid file path format for boot or crash files. Expected format: <type>/<bare_filename>'
            });
        }
        
        const type = fn_path_split[1];
        const bare_filename = fn_path_split[2];
        obj_path = `${dongle_id}/${type}/${bare_filename}`;
    }
    else {
        const fn_path_split = fn_path.match(/^(.*)--(\d+)\/(.*)$/);
        if (!fn_path_split) {
            return res.status(400).json({
                error: 'Invalid file path format. Expected format: <dongle_id>/<route_id>/<segment_id>/<bare_filename>'
            });
        }
        
        const route_id = fn_path_split[1];
        const segment_id = fn_path_split[2];
        const bare_filename = fn_path_split[3];

        obj_path = `${dongle_id}/${route_id}/${route_id}--${segment_id}/${bare_filename}`;
    }
    const [err, url] = await safeAwait(
        minioClient.presignedPutObject(
            'comma-upload',
            obj_path,
            24 * 60 * 60)
        );
    if (err) {
        console.error(err);
        return res.status(500).json({
            error: 'Failed to generate upload URL'
        });
    }
    // if ip is not within private range, replace MINIO_PORT with 443
    if (!real_ip.startsWith('10.') && !real_ip.startsWith('192.168.') && !real_ip.startsWith('172.')) {
        url = url.replace(`:${process.env.MINIO_PORT || 443}`, ':443');
    }
    res.json({
        url: url,
        headers: {
            'x-amz-acl': 'public-read',
        }
    });
    
});

app.get('/v1/devices/:dongle_id/firehose_stats', async (req, res) => {
    const { dongle_id } = req.params;
    res.json({
        firehose: 69420
    });
});

app.listen(process.env.PORT || 3000, '0.0.0.0' ,() => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});