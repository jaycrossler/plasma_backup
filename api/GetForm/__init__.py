import logging
import datetime  
import azure.functions as func
import json
import re

# TESTS:
# Should Fail: http://localhost:7071/api/GetForm?zip_code=-1&form_data=1,1,1a,1
# Should Fail: http://localhost:7071/api/GetForm?zip_code=as&form_data=1,1,1,1
# Should Fail: http://localhost:7071/api/GetForm?zip_code=1234567&form_data=1,1,1,1
# Should Fail: http://localhost:7071/api/GetForm?zip_code=1234567&form_data=1.1.1.1
# Should Fail: http://localhost:7071/api/GetForm?zip_code=123456&form_data=1,2,3,4,5,6,7,8,9,10,11

# Should Pass: http://localhost:7071/api/GetForm?zip_code=-1&form_data=1,1,1,1,1,1
# Should Pass: http://localhost:7071/api/GetForm?zip_code=11101&form_data=1,1,1,1,1,1

default_form_data = "0,0,0,0,0,0"

def main(req: func.HttpRequest, msg: func.Out[func.QueueMessage]) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a form request.')

    # Pull from Querystring
    form_data = req.params.get('form_data')
    zip_code = req.params.get('zip_code')

    # If both don't exist, pull from bbody
    if not form_data or not zip_code:
        try:
            req_body = req.get_json()
        except ValueError:
            pass
        else:
            form_data = req_body.get('form_data')
            zip_code = req_body.get('zip_code')

    #Check that zip is valid
    try:
        if len(zip_code) < 6:
            zip_code = int(zip_code)
            zip_code_valid = True
        else:
            zip_code_valid = False
    except (ValueError, TypeError) as e:
        zip_code_valid = False
        zip_code = -1

    #check that form data is comma separated numbers
    try:
        form_data_valid = bool(re.match('^[0-9,]+$', form_data))
        if not form_data_valid or len(form_data) > 20:
            form_data_valid = False
            form_data = default_form_data
    except TypeError:
        form_data_valid = False
        form_data = default_form_data

    # If both valid
    if form_data_valid and zip_code_valid:
        # Log a message to the message queue, using msg.set
        msg.set(f"{zip_code} : {form_data} : {datetime.datetime.now()}")

        if zip_code == -1:
            response = "ok"
        else:
            #TODO: Replace with zip lookup
            test = [{"address":"abc street", "distance":"5 miles"}, {"address":"def street", "distance":"9 miles"}]
            response = json.dumps(test)
        return func.HttpResponse(response)
    else:
        return func.HttpResponse(
             "Please pass zip_code and form_data in the querystring or as json",
             status_code=400
        )