require('dotenv').config()
const fs = require('fs')
const S3 = require('aws-sdk/clients/s3')

const bucketName = process.env.AWS_BUCKET_NAME
const region = process.env.AWS_BUCKET_REGION
const accessKeyId = process.env.AWS_ACCESS_KEY
const secretAccessKey = process.env.AWS_SECRET_KEY


const s3 = new S3({
  region,
  accessKeyId,
  secretAccessKey
})

function uploadAvatar(file) {
  const fileStream = fs.createReadStream(file.path)

  const uploadParams = {
    Bucket: bucketName,
    Body: fileStream,
    Key: file.filename
  }

  return s3.upload(uploadParams).promise()
}
exports.uploadAvatar = uploadAvatar

const chat_files_s3 = new S3({
  region: process.env.AWS_FILES_BUCKET_REGION,
  accessKeyId: process.env.AWS_FILES_ACCESS_KEY,
  secretAccessKey: process.env.AWS_FILES_SECRET_KEY
})

exports.uploadChatFiles = async (files) => {

  const params = files.map((file) => {
    const fileStream = fs.createReadStream(file.path)
    return {
      Bucket: process.env.AWS_FILES_BUCKET_NAME,
      Body: fileStream,
      Key: file.filename
    };
  });

  return await Promise.all(params.map((param) => chat_files_s3.upload(param).promise()));
};

exports.deleteAllFiles = async(files) => {

  function emptyBucket(bucketName,callback){
    var params = {
      Bucket: bucketName
    };
  
    chat_files_s3.listObjects(params, function(err, data) {
      if (err) return callback(err);
      if (data.Contents.length == 0) callback();
  
      params = {Bucket: bucketName};
      params.Delete = {Objects:[]};
      
      data.Contents.forEach(function(content) {
        params.Delete.Objects.push({Key: content.Key});
      });
  
      chat_files_s3.deleteObjects(params, function(err, data) {
        if (err) return callback(err);
        if (data.IsTruncated) {
          emptyBucket(bucketName, callback);
        } else {
          callback();
        }
      });
    });
  }

  emptyBucket(process.env.AWS_FILES_BUCKET_NAME, () => {
    console.log('refreshed')
  })

};

