// Import utilities
import _ from 'underscore';
import 'girder/utilities/jquery/girderModal';
import { restRequest } from 'girder/rest';
import events from 'girder/events';

// Import views
import View from 'girder/views/View';

// Import about Creatis
import ConfirmPipelineDialogTemplate from '../templates/confirmPipelineDialog.pug';

function getTimestamp () {
  return (Math.round((new Date()).getTime() / 1000));
}

function checkError (data) {
  if (typeof data.errorCode !== 'undefined' && data.errorCode != null) {
    events.trigger('g:alert', {
      text: data.errorMessage,
      type: "danger",
      duration: 3000
    });
    return 1;
  }
  return 0;
}

// Liste les applications de VIP accessibles par l'utilisateur
var ConfirmPipelineDialog = View.extend({

  initialize: function (settings) {
    this.file = settings.file;
    this.currentPipeline = settings.pipeline;
    this.foldersCollection = settings.foldersCollection;
    this.carmin = settings.carmin;
    this.pathVIP = "vip/Home/Girder/";
    this.filesInput = [this.file._id];
    this.parameters = {};

    // Trie le tableau foldersCollection en fonction de "path"
    this.foldersCollection.sort(function(a, b){
      return a.path.localeCompare(b.path)
    });

    this.render();
  },

  events: {
    'submit .creatis-launch-pipeline-form' : 'initPipeline'
  },

  render: function () {
    $('#g-dialog-container').html(ConfirmPipelineDialogTemplate({
      pipeline: this.currentPipeline,
      file: this.file,
      folders: this.foldersCollection
    })).girderModal(this);

    return this;
  },

  initPipeline: function (e) {
    e.preventDefault();
    $('#g-dialog-container').find('a.close').click();
    var folderPath = this.pathVIP + "process-" + getTimestamp();

    console.log("Check folder Girder");
    // Check if Girder folder exists
    this.carmin.fileExists(this.pathVIP, function (data) {
      if (!data.exists) {
        console.log("Doesn't exist");
        console.log("Create folder Girder/");
        this.carmin.createFolder(this.pathVIP, function (data) {
          if (!checkError(data)) {
            console.log("OK");
            this.sendFile(folderPath);
          }
        }.bind(this));
      } else {
        console.log("Exist");
        this.sendFile(folderPath);
      }
    }.bind(this));
  },

  sendFile: function (folderPath) {
    // Create folder to this process
    console.log("Create folder process-xxxxxx/");
    this.carmin.createFolder(folderPath, function (data) {
      if (!checkError(data)) {
        console.log("OK");
        // Send file into folder
        console.log("Send file");
        this.carmin.uploadData(folderPath + "/" + this.file.name, this.file.data, function (data) {
          if (!checkError(data)) {
            console.log("OK");
            this.launchPipeline(folderPath);
          }
        }.bind(this));
      }
    }.bind(this));
  },

  launchPipeline: function (folderPath) {
    this.form = this.$el[0].firstChild.firstChild.firstChild;
    var nameExecution = this.form[0].value;
    var folderGirderDestination = this.form[1].value;
    var sendMail = this.form[2].checked;
    var pathFileVIP = folderPath + "/" + this.file.name;

    // Fill paramaters
    _.each(this.currentPipeline.parameters, function(param) {
      if (!(param.type == "File" && !param.defaultValue) && !param.defaultValue) {
        this.parameters[param.name] = $('#'+param.name).val();
      } else if (param.type == 'File' && !param.defaultValue) {
        this.parameters[param.name] = folderPath + "/" + this.file.name;
      } else {
        this.parameters[param.name] = param.defaultValue;
      }
    }.bind(this));

    this.carmin.initAndStart(nameExecution, this.currentPipeline.identifier, this.parameters, function (data) {
      if (!checkError(data)) {
        var filesInput = $.extend({}, this.filesInput);
        var params = {
          name: data.name,
          fileId: JSON.stringify(filesInput),
          pipelineName: this.currentPipeline.name,
          vipExecutionId: data.identifier,
          status: data.status,
          pathResultGirder: folderGirderDestination,
          sendMail: sendMail,
          listFileResult: '{}',
          timestampFin: null
        };

        restRequest({
          method: 'POST',
          url: 'pipeline_execution',
          data: params
        }).done(function (resp){
          events.trigger('g:alert', {
            text: "The execution is launched correctly",
            type: "success",
            duration: 3000
          });
        });
      }

    }.bind(this));
  }

});

export default ConfirmPipelineDialog;
