import json

def lambda_handler(event, context):
    http_method = event.get('httpMethod', 'GET')
    path_params = event.get('pathParameters', {})
    query_params = event.get('queryStringParameters', {})
    resource_path = event.get('resource', '')
    body = event.get('body')

    # Added comment here
    
    if http_method == "GET" and resource_path=="/tracks":
        try:
            return {
                'statusCode': 200,
                'body': "High Assurance Track"
            }
        except:
            return{
                'statusCode': 500,
                'body': "The system encountered an error while retrieving the student's track information."
            }