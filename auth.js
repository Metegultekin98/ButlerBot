const token = require('./token.json');

module.exports = {
    getToken: function() {
        return token.DCtoken;
    },

    getTestId: token.testVC,

    getTestServerId: token.testServer

}