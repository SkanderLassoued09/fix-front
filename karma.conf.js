// Configuration Karma — référencée par `angular.json` (cible `test`) mais
// ABSENTE du dépôt jusqu'ici : `ng test` échouait donc immédiatement, ce qui
// explique qu'aucun spec frontend n'ait jamais été écrit.
//
// `ChromeHeadlessNoSandbox` : le bac à sable Chrome ne fonctionne pas dans un
// conteneur ni sous certains durcissements noyau. Renseigner `CHROME_BIN` si
// aucun Chrome système n'est installé, p. ex. le binaire fourni par Playwright.
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: { jasmine: {}, clearContext: false },
    jasmineHtmlReporter: { suppressAll: true },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/sakai-ng'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
  });
};
