
var AWS = require("aws-sdk"),
    fs = require('fs'),
    gm = require('gm').subClass({imageMagick: true});
AWS.config.loadFromPath('config.json');
var s3 = new AWS.S3(),
    sqs = new AWS.SQS();


var QUEUE_URL = "https://sqs.us-west-2.amazonaws.com/607083138257/queuedawid",
    LOOP_TIMEOUT = 10000,
    BUCKET_NAME = "bucketdawid",
    TEMP_FOLDER = "tmp/";


function receiveMessages()
{
   var param =
   {
      QueueUrl: QUEUE_URL,
      AttributeNames: ['All'],
      MaxNumberOfMessages: 1,
      MessageAttributeNames: ['key','bucket'],
      VisibilityTimeout: 10,
      WaitTimeSeconds: 0
   }
   sqs.receiveMessage(
      param,
      function(err, msgData)
      {
         if(err)
	    console.log(err, err.stack)
	 else if(!msgData.Messages)
            console.log("No messages")
         else
         {
            console.log("New message received")

            var receiptHandle = msgData.Messages[0].ReceiptHandle

	          var picData = msgData.Messages[0].Body.split('/')

            var fileName = picData[1]
            console.log(picData)
            console.log(fileName)
            var newFile = fs.createWriteStream(TEMP_FOLDER + fileName)

	    var param =
            {
               Bucket: BUCKET_NAME,
               Key: picData[0] + '/' + fileName
	    }
            var request = s3.getObject(param).createReadStream().pipe(newFile)
            request.on(
               'finish',
               function(err, data)
               {

                      console.log("ooo")
                      gm(TEMP_FOLDER+picData[1]).sepia().write(TEMP_FOLDER+picData[1], function (err) {

                           if(err)
                              console.log(err, err.stack)
                           else
                           {
                              console.log("Processed the file")

                              var fStream = fs.createReadStream(TEMP_FOLDER + fileName)
                              fStream.on(
                                 'open',
                                 function()
                                 {
                                    var param =
                                    {
                                       Bucket: BUCKET_NAME,
                                       Key: 'photos/' + fileName,
                                       ACL: 'public-read',
                                       Body: fStream
                                    }
                                    s3.putObject(
                                       param,
                                       function(err, data)
                                       {
                                          if(err)
                                             console.log(err, err.stack)
                                          else
                                          {
                                             console.log("Put to Bucket")

                                                        var param =
                                                      {
                                                         QueueUrl: QUEUE_URL,
                                                         ReceiptHandle: receiptHandle
                                                      }
                                                      sqs.deleteMessage(
                                                         param,
                                                         function(err, data)
                                                         {
                                                            if(err)
                                                               console.log(err, err.stack)
                                                            else
                                                               console.log("Deleted handled message from the queue.")
                                                         })

                                          }
                                       })
                                 })
                           }
                        })

               })
         }
      })
      setTimeout(receiveMessages, LOOP_TIMEOUT)
}

receiveMessages();
