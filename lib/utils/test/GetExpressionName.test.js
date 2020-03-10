var expect = require('expect.js');
var getExpressionName = require('../GetExpressionName.js');

describe('Simple ExpressionName Tests', function(){
    it('MemberExpression', function(){
        expect(getExpressionName({
            type: 'MemberExpression',
            computed: false,
            object:
            { type: 'MemberExpression',
                computed: false,
                object: { type: 'ThisExpression' },
                property: { type: 'Identifier', name: '_form_holder' } },
            property: { type: 'Identifier', name: 'get_submit_handler_callback' }
        })).to.be("_form_holder.get_submit_handler_callback");

    });


});