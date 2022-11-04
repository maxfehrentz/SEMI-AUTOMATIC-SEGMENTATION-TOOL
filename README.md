# A Semi-Automatic Segmentation Tool

The tool in its current state works on grape bunch instance segmentation. It suggests masks and lets the user refine it via the iterative click-based method FocalClick.

## Installation
Get node.js and npm from https://nodejs.org/en/download/releases/. This project uses v14.20.1. Use `pip install` to get all the requirements listed in requirements.txt.

## Usage

### Starting the back-end
Navigate to the Back-End folder and run `uvicorn main:app --reload`.

### Starting the front-end
Run `npm install`, then `npm start`. This command will start the front-end of the application. Then open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.