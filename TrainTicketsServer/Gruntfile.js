module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: 'src/factorial.js',
        dest: 'build/factorial.min.js'
      }
    },
    nodemon: {
       dev: {
        script: 'app.js'
       }
      }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  //for running server
  grunt.loadNpmTasks('grunt-nodemon');

  // Default task(s).
  grunt.registerTask('default', ['uglify']);
  grunt.registerTask('serve', ['nodemon']);

};