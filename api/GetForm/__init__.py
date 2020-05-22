import logging
import datetime  # MODIFICATION: added import
import azure.functions as func

# MODIFICATION: the added binding appears as an argument; func.Out[func.QueueMessage]
# is the appropriate type for an output binding with "type": "queue" (in function.json).
def main(req: func.HttpRequest, msg: func.Out[func.QueueMessage]) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')

    name = req.params.get('name')
    if not name:
        try:
            req_body = req.get_json()
        except ValueError:
            pass
        else:
            name = req_body.get('name')

    if name:
        # MODIFICATION: write the a message to the message queue, using msg.set
        msg.set(f"Request made for {name} at {datetime.datetime.now()}")

        return func.HttpResponse(f"Hello {name}!")
    else:
        return func.HttpResponse(
             "Please pass a name on the query string or in the request body",
             status_code=400
        )