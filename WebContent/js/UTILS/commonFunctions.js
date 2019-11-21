function assertionValidate(tdData, assertions, manualAssertions, tdSchema,schemaDraft) {

    // a JSON file that will be returned containing the result for each assertion as a JSON Object
    var results = [];
    console.log("=================================================================");
    //console.log(schemaDraft)

    // check whether it is a valid UTF-8 string
   /* if (isUtf8(tdData)) {
        results.push({
            "ID": "td-json-open_utf-8",
            "Status": "pass"
        });
    } else {
        throw "td-json-open_utf-8";
    }
*/
    //check whether it is a valid JSON
    try {
        var tdJson = JSON.parse(tdData);
        results.push({
            "ID": "td-json-open",
            "Status": "pass"
        });
    } catch (error) {
        throw "td-json-open";
    }

    // checking whether two interactions of the same interaction affordance type have the same names
    // This requires to use the string version of the TD that will be passed down to the jsonvalidator library
    var tdDataString = tdData.toString();
    console.log(results)
    results = checkUniqueness(tdDataString,results);


    // Normal TD Schema validation but this allows us to test multiple assertions at once
    try {
        results = checkVocabulary(tdJson, results, tdSchema, schemaDraft);
        console.log(results)
    } catch (error) {
        console.log({
            "ID": error,
            "Status": "fail"
        });
        throw "Invalid TD"
    }

    // additional checks
    
    results = checkSecurity(tdJson,results);
    

    results = checkMultiLangConsistency(tdJson, results);
    

    // Iterating through assertions

    for (let index = 0; index < assertions.length; index++) {
        const curAssertion = assertions[index];
        
        var schema = curAssertion

        // Validation starts here

        const avj_options = {
            "$comment": function (v) {
                console.log("\n!!!! COMMENT", v)
            },
            "allErrors": true
        };
        var ajv = new Ajv(avj_options);
        ajv.addMetaSchema(draft);
        ajv.addSchema(schema, 'td');


        var valid = ajv.validate('td', tdJson);

        /*
            If valid then it is not implemented
            if error says not-impl then it is not implemented
            If somehow error says fail then it is failed

            Output is structured as follows:
            [main assertion]:[sub assertion if exists]=[result]
        */
        if (schema["is-complex"]) {
            if (valid) {
                // console.log('Assertion ' + schema.title + ' not implemented');
                results.push({
                    "ID": schema.title,
                    "Status": "not-impl"
                });
                if (schema.hasOwnProperty("also")) {
                    var otherAssertions = schema.also;
                    otherAssertions.forEach(function (asser) {
                        results.push({
                            "ID": asser,
                            "Status": "not-impl"
                        });
                    });
                }

            } else {
                try {
                    var output = ajv.errors[0].params.allowedValue;

                    var resultStart = output.indexOf("=");
                    var result = output.slice(resultStart + 1);

                    if (result == "pass") {
                        results.push({
                            "ID": schema.title,
                            "Status": result
                        });
                    } else {
                        results.push({
                            "ID": schema.title,
                            "Status": result,
                            "Comment": ajv.errorsText()
                        });
                    }
                    if (schema.hasOwnProperty("also")) {
                        var otherAssertions = schema.also;
                        otherAssertions.forEach(function (asser) {
                            results.push({
                                "ID": asser,
                                "Status": result
                            });
                        });
                    }
                    //there was some other error, so it is fail
                } catch (error1) {
                    results.push({
                        "ID": schema.title,
                        "Status": "fail",
                        "Comment": "Make sure you validate your TD before"
                    });

                    if (schema.hasOwnProperty("also")) {
                        var otherAssertions = schema.also;
                        otherAssertions.forEach(function (asser) {
                            results.push({
                                "ID": asser,
                                "Status": "fail",
                                "Comment": "Make sure you validate your TD before"
                            });
                        });
                    }
                }
            }

        } else {
            if (valid) {
                // console.log('Assertion ' + schema.title + ' implemented');
                results.push({
                    "ID": schema.title,
                    "Status": "pass"
                });
                if (schema.hasOwnProperty("also")) {
                    var otherAssertions = schema.also;
                    otherAssertions.forEach(function (asser) {
                        results.push({
                            "ID": asser,
                            "Status": "pass"
                        });
                    });
                }
            } else {
                // failed because a required is not implemented
                // console.log('> ' + ajv.errorsText());
                if (ajv.errorsText().indexOf("required") > -1) {
                    //failed because it doesnt have required key which is a non implemented feature
                    // console.log('Assertion ' + schema.title + ' not implemented');
                    results.push({
                        "ID": schema.title,
                        "Status": "not-impl",
                        "Comment": ajv.errorsText()
                    });
                    if (schema.hasOwnProperty("also")) {
                        var otherAssertions = schema.also;
                        otherAssertions.forEach(function (asser) {
                            results.push({
                                "ID": asser,
                                "Status": "not-impl",
                                "Comment": ajv.errorsText()
                            });
                        });
                    }
                } else {
                    //failed because of some other reason
                    // console.log('Assertion ' + schema.title + ' failed');
                    results.push({
                        "ID": schema.title,
                        "Status": "fail",
                        "Comment": ajv.errorsText()
                    });
                    if (schema.hasOwnProperty("also")) {
                        var otherAssertions = schema.also;
                        otherAssertions.forEach(function (asser) {
                            results.push({
                                "ID": asser,
                                "Status": "fail",
                                "Comment": ajv.errorsText()
                            });
                        });
                    }
                }
            }
        }
    }

    results = mergeIdenticalResults(results);
    results = createParents(results);


    // sort according to the ID in each item
    orderedResults = results.sort(function (a, b) {
        var idA = a.ID;
        var idB = b.ID;
        if (idA < idB) {
            return -1;
        }
        if (idA > idB) {
            return 1;
        }

        // if ids are equal
        return 0;
    });

    results = orderedResults.concat(manualAssertions);
    var csvResults = json2csvParser.parse(results);
    return csvResults;
}

function checkVocabulary(tdJson, results, tdSchema, draft) {
    /*
    Validates the following assertions:
    td - processor
    td-objects:securityDefinitions
    td-arrays:security
    td:security
    td-security-mandatory
    */
console.log("in check vocbulary")
   var results=[]

    var ajv = new Ajv();
    ajv.addMetaSchema(draft);
    ajv.addSchema(tdSchema, 'td');
    

    var valid = ajv.validate('td', tdJson);
    var otherAssertions = ["td-objects_securityDefinitions", "td-arrays_security", "td-vocab-security--Thing", "td-security-mandatory", "td-vocab-securityDefinitions--Thing", "td-context-toplevel", "td-vocab-title--Thing", "td-vocab-security--Thing", "td-vocab-id--Thing", "td-security", "td-security-activation", "td-context-ns-thing-mandatory", "td-map-type", "td-array-type", "td-class-type", "td-string-type", "td-security-schemes"];

    if (valid) {
        results.push({
            "ID": "td-processor",
            "Status": "pass",
        });

        otherAssertions.forEach(function (asser) {
            results.push({
                "ID": asser,
                "Status": "pass"
            });
        });
        return results;

    } else {
        // console.log("VALIDATION ERROR!!! : ", ajv.errorsText());
        // results.push({
        //     "ID": "td-processor",
        //     "Status": "fail",
        //     "Comment": "invalid TD"
        // });
        // otherAssertions.forEach(function (asser) {
        //     results.push({
        //         "ID": asser,
        //         "Status": "fail"
        //     });
        // });
        throw "invalid TD jhkjhkjhjh";
    }
}


function checkSecurity(td,results) {
    if (td.hasOwnProperty("securityDefinitions")) {
        var securityDefinitionsObject = td.securityDefinitions;
        var securityDefinitions = Object.keys(securityDefinitionsObject);


        var rootSecurity = td.security;

        if (securityContains(securityDefinitions, rootSecurity)) {
            // all good
        } else {
            results.push({
                "ID": "td-security-scheme-name",
                "Status": "fail",
                "Comment": "used a non defined security scheme in root level"
            });
            return results;
        }

        if (td.hasOwnProperty("properties")) {
            //checking security in property level
            tdProperties = Object.keys(td.properties);
            for (var i = 0; i < tdProperties.length; i++) {
                var curPropertyName = tdProperties[i];
                var curProperty = td.properties[curPropertyName];

                // checking security in forms level
                var curForms = curProperty.forms;
                for (var j = 0; j < curForms.length; j++) {
                    var curForm = curForms[j];
                    if (curForm.hasOwnProperty("security")) {
                        var curSecurity = curForm.security;
                        if (securityContains(securityDefinitions, curSecurity)) {
                            // all good
                        } else {
                            results.push({
                                "ID": "td-security-scheme-name",
                                "Status": "fail",
                                "Comment": "used a non defined security scheme in a property form"
                            });
                            return results;
                        }
                    }
                }
            }
        }

        if (td.hasOwnProperty("actions")) {
            //checking security in action level
            tdActions = Object.keys(td.actions);
            for (var i = 0; i < tdActions.length; i++) {
                var curActionName = tdActions[i];
                var curAction = td.actions[curActionName];

                // checking security in forms level 
                var curForms = curAction.forms;
                for (var j = 0; j < curForms.length; j++) {
                    var curForm = curForms[j];
                    if (curForm.hasOwnProperty("security")) {
                        var curSecurity = curForm.security;
                        if (securityContains(securityDefinitions, curSecurity)) {
                            // all good
                        } else {
                            results.push({
                                "ID": "td-security-scheme-name",
                                "Status": "fail",
                                "Comment": "used a non defined security scheme in an action form"
                            });
                            return results;
                        }
                    }
                }

            }
        }

        if (td.hasOwnProperty("events")) {
            //checking security in event level
            tdEvents = Object.keys(td.events);
            for (var i = 0; i < tdEvents.length; i++) {
                var curEventName = tdEvents[i];
                var curEvent = td.events[curEventName];

                // checking security in forms level
                var curForms = curEvent.forms;
                for (var j = 0; j < curForms.length; j++) {
                    var curForm = curForms[j];
                    if (curForm.hasOwnProperty("security")) {
                        var curSecurity = curForm.security;
                        if (securityContains(securityDefinitions, curSecurity)) {
                            // all good
                        } else {
                            results.push({
                                "ID": "td-security-scheme-name",
                                "Status": "fail",
                                "Comment": "used a non defined security scheme in an event form"
                            });
                            return results;
                        }
                    }
                }

            }
        }

        //no security used non defined scheme, passed test
        results.push({
            "ID": "td-security-scheme-name",
            "Status": "pass"
        });
        return results;

    } else {}
    return results;
}

function checkMultiLangConsistency(td, results) {
    console.log(results)

    // this checks whether all titles and descriptions have the same language fields 
    // so the object keys of a titles and of a descriptions should be the same already, then everywhere else they should also be the same

    // first collect them all, and then compare them

    var multiLang = []; //an array of arrays where each small array has the multilang keys
    var is_td_titles_descriptions = []; // an array of boolean values to check td-titles-descriptions assertion

    // checking root
    if (td.hasOwnProperty("titles")) {
        var rootTitlesObject = td.titles;
        var rootTitles = Object.keys(rootTitlesObject);
        multiLang.push(rootTitles);
        //checking for td-titles-descriptions
        is_td_titles_descriptions.push({["root_title"]: isStringObjectKeyValue(td.title, rootTitlesObject)});
    }

    if (td.hasOwnProperty("descriptions")) {
        var rootDescriptionsObject = td.descriptions;
        var rootDescriptions = Object.keys(rootDescriptionsObject);
        multiLang.push(rootDescriptions);
        // check whether description exists in descriptions
        if (td.hasOwnProperty("description")) is_td_titles_descriptions.push({["root_description"]: isStringObjectKeyValue(td.description, rootDescriptionsObject)})
    }

    // checking inside each interaction
    if (td.hasOwnProperty("properties")) {
        //checking security in property level
        tdProperties = Object.keys(td.properties);
        for (var i = 0; i < tdProperties.length; i++) {
            var curPropertyName = tdProperties[i];
            var curProperty = td.properties[curPropertyName];

            if (curProperty.hasOwnProperty("titles")) {
                var titlesKeys = Object.keys(curProperty.titles);
                multiLang.push(titlesKeys);
                //checking if title exists in titles
                if (curProperty.hasOwnProperty("title")) is_td_titles_descriptions.push({["property_"+curPropertyName + "_title"]: isStringObjectKeyValue(curProperty.title, curProperty.titles)})
            }

            if (curProperty.hasOwnProperty("descriptions")) {
                var descriptionsKeys = Object.keys(curProperty.descriptions);
                multiLang.push(descriptionsKeys);
                // checking if description exists in descriptions
                if (curProperty.hasOwnProperty("description")) is_td_titles_descriptions.push({["property_" + curPropertyName + "_desc"]: isStringObjectKeyValue(curProperty.description, curProperty.descriptions)
                })
            }
        }
    }

    if (td.hasOwnProperty("actions")) {
        //checking security in action level
        tdActions = Object.keys(td.actions);
        for (var i = 0; i < tdActions.length; i++) {
            var curActionName = tdActions[i];
            var curAction = td.actions[curActionName];

            if (curAction.hasOwnProperty("titles")) {
                var titlesKeys = Object.keys(curAction.titles);
                multiLang.push(titlesKeys);
                //checking if title exists in titles
                if (curAction.hasOwnProperty("title")) is_td_titles_descriptions.push({["action_" + curActionName + "_title"]: isStringObjectKeyValue(curAction.title, curAction.titles)
                })
            }

            if (curAction.hasOwnProperty("descriptions")) {
                var descriptionsKeys = Object.keys(curAction.descriptions);
                multiLang.push(descriptionsKeys);
                // checking if description exists in descriptions
                if (curAction.hasOwnProperty("description")) is_td_titles_descriptions.push({["action_" + curActionName + "_desc"]: isStringObjectKeyValue(curAction.description, curAction.descriptions)
                            })
            }

        }
    }

    if (td.hasOwnProperty("events")) {
        //checking security in event level
        tdEvents = Object.keys(td.events);
        for (var i = 0; i < tdEvents.length; i++) {
            var curEventName = tdEvents[i];
            var curEvent = td.events[curEventName];

            if (curEvent.hasOwnProperty("titles")) {
                var titlesKeys = Object.keys(curEvent.titles);
                multiLang.push(titlesKeys);
                //checking if title exists in titles
                if (curEvent.hasOwnProperty("title")) is_td_titles_descriptions.push({["event_" + curEventName + "_title"]: isStringObjectKeyValue(curEvent.title, curEvent.titles)
                            })
            }

            if (curEvent.hasOwnProperty("descriptions")) {
                var descriptionsKeys = Object.keys(curEvent.descriptions);
                multiLang.push(descriptionsKeys);
                // checking if description exists in descriptions
                if (curEvent.hasOwnProperty("description")) is_td_titles_descriptions.push({["event_" + curEventName + "_desc"]: isStringObjectKeyValue(curEvent.description, curEvent.descriptions)
                })
            }

        }
    }
    if(arrayArraysItemsEqual(multiLang)){
        results.push({
            "ID": "td-multi-languages-consistent",
            "Status": "pass"
        });
    } else {
        results.push({
            "ID": "td-multi-languages-consistent",
            "Status": "fail",
            "Comment": "not all multilang objects have same language tags"
        });
    }

    var flatArray = []; //this is multiLang but flat, so just a single array. This way we can have scan the whole thing at once and then find the element that is not bcp47
    for (let index = 0; index < multiLang.length; index++) {
        var arrayElement = multiLang[index];
        arrayElement=JSON.parse(arrayElement);
        for (let index = 0; index < arrayElement.length; index++) {
            const stringElement = arrayElement[index];
            flatArray.push(stringElement);
        }
    }
    var isBCP47 = checkBCP47array(flatArray);
    if(isBCP47=="ok"){
        results.push({
            "ID": "td-multilanguage-language-tag",
            "Status": "pass"
        });
    } else {
        results.push({
            "ID": "td-multilanguage-language-tag",
            "Status": "fail",
            "Comment":isBCP47+" is not a BCP47 tag"
        });
    }

    //checking td-context-default-language-direction-script assertion
    results.push({
        "ID": "td-context-default-language-direction-script",
        "Status": checkAzeri(flatArray)
    });

    // checking td-titles-descriptions assertion
    // if there are no multilang, then it is not impl
    if(is_td_titles_descriptions.length==0){
        results.push({
            "ID": "td-titles-descriptions",
            "Status": "not-impl",
            "Comment": "no multilang objects in the td"
        });
        return results;
    }

    // if at some point there was a false result, it is a fail
    for (let index = 0; index < is_td_titles_descriptions.length; index++) {
        const element = is_td_titles_descriptions[index];
        var elementName = Object.keys(element);

        if(element[elementName]){
            // do nothing it is correct
        } else {
            results.push({
                "ID": "td-titles-descriptions",
                "Status": "fail",
                "Comment": elementName+" is not on the multilang object at the same level"
            });
            return results;
        }
    }
    //there was no problem, so just put pass
    results.push({
        "ID": "td-titles-descriptions",
        "Status": "pass"
    });
    
    // ? nothing after this, there is return above
    return results;
}

function arrayArraysItemsEqual(myArray) {
    if(myArray.length==0) return true;
    //first stringify each array item
    for (var i = myArray.length; i--;) {
        myArray[i] = JSON.stringify(myArray[i])
    }

    for (var i = myArray.length; i--;) {
        if (i == 0) {
            return true;
        }
        if (myArray[i] !== myArray[i - 1]){
            return false;
        }
    }
}