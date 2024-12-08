# ECE 461 Group 11 - Package Registry

A web-based Node.js package registry system with modern UI and comprehensive package management capabilities.

## Features

### Package Management
- Upload packages via ZIP file or URL (NPM/GitHub)
- Search packages by name and version
- Download packages
- Version control support

### Package Analysis
- Package ratings with multiple metrics
- Cost analysis
- Installation size evaluation
- Maintenance metrics

## Technologies
- TypeScript
- Node.js
- AWS Lambda
- DynamoDB
- S3 Storage

## UI Features
- Responsive design with mobile support
- Modern typography using Google Fonts (Roboto, Poppins)
- Clean color scheme (#3498db, #2c3e50)
- Interactive loading states
- Clear error handling
- Intuitive form layouts

## Contributors
- Rishab Pangal
- Shrijan Swaminathan
- Aarav Patel

## Endpoints
- Web Interface: http://3.140.252.124/
- API URL: https://dofogoenof.execute-api.us-east-2.amazonaws.com/MainStage
    - POST /package: Upload a new package (either via URL or Zip)
    - GET /package/{id}: Download a specific package
    - POST /packages: Search packages with version filtering
    - GET /package/{id}/rate: Get package ratings
    - POST /package/byRegEx: Search packages using regex
    - POST /package/{id}: Update package


## License
[Add License Information]