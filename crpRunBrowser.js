function (program, bid, data, onProgress, onResult, onFinished) {
      var dataLength = data.length;
      var jobId;

      jobs.createJob(program, bid, afterCreateJob);

      function afterCreateJob(error, id) {
        if (error) {
          throw new Error(error.message);
        }

        jobId = id;
        console.log('Created job "%s"', id);

        var n = dataLength;
        while(n--) {
          jobs.queueData(id, data[n], afterQueueData);
        }

      }

      var queueCount = 0;
      function afterQueueData(error) {
        if (error) {
          throw new Error(error.message);
        }

        ++queueCount;
        if (queueCount === dataLength)
          afterQueueAllData();
      }

      function afterQueueAllData() {
        jobs.activateJob(jobId, afterActivateJob);
      }

      function afterActivateJob(error) {

        if (error) {
          throw new Error(error.message);
        }

        jobs.subscribeResults(jobId, onResultKey);
        jobs.subscribeFinished(jobId, onFinished);
        console.log('Activated job. Waiting for results');
      }

      var resultcount = 0;
      function onResultKey(resultKey) {
        ++resultcount;

        onProgress(Math.floor((resultcount/dataLength) * 100));
        jobs.getResult(resultKey, onResult);
      }


      if (onABrowser) {
        window.onunload(cleanupJob);
      } else {
        process.on('SIGINT', cleanupJob);
      }

      function cleanupJob () {
        deleteJob(jobId);
      }

    }