# A Semi-Automatic Segmentation Tool

The tool in its current state works on grape bunch instance segmentation. It suggests masks and lets the user refine it via the iterative click-based method FocalClick.

## Installation
Get node.js and npm from https://nodejs.org/en/download/releases/. This project uses v14.20.1. Execute `pip install -r requirements.txt` in the root folder to get all the requirements listed in requirements.txt.

## Running the application in the Chrome browser

### Starting the back-end
Navigate to the Back-End folder and run `uvicorn main:app --reload`.

### Starting the front-end
Run `npm install`, then `npm start`. This command will start the front-end of the application. Then open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes to the front-end. You may also see any lint errors in the console.

## Annotation process
Negative clicks can be placed with a right-click, positive clicks are triggered with a left-click.