process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const Minio = require('minio');
const { safeAwait } = require('./utils');
 
const app = express();

const minioClient = new Minio.Client({
    endPoint: 'nas.motiflab.net',
    port: 9000,
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
        prime_type: 1,
    })
});

app.get('/v1.4/:dongle_id/upload_url/', async (req, res) => {
    const { dongle_id } = req.params;
    const file_path = req.query.path;
    if (!file_path) {
        return res.status(400).send('file_path is required');
    }
    const obj_path = `${dongle_id}/${decodeURIComponent(file_path)}`;
    const [err, url] = await safeAwait(
        minioClient.presignedPutObject(
            'comma-upload',
            obj_path,
            24 * 60 * 60)
        );
    if (err) {
        console.error(err);
        return res.status(500).send('Error generating presigned URL');
    }
    res.json({
        url: url,
        headers: {
            'x-amz-acl': 'public-read',
        }
    });
    
});

app.listen(process.env.PORT || 3000, '0.0.0.0' ,() => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});