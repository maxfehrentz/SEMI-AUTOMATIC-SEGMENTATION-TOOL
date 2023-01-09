# A Semi-Automatic Segmentation Tool

The tool in its current state works on grape bunch instance segmentation. It suggests masks and lets the user refine it via the iterative click-based method FocalClick.

## Installation
- Get node.js and npm from https://nodejs.org/en/download/releases/. This project uses v14.20.1. 
- Execute `pip install -r requirements.txt` in the root folder to get all the requirements for the backend listed in requirements.txt. 
- Run `npm install` to install all requirements for the frontend defined in package.json.
- Download the models that are required
    - Download the segformer model for FocalClick from [here](https://drive.google.com/file/d/1DkFun_tiw7z7RpjDtwqV65k1e9jxnLkr/view?usp=share_link), place it in [Back-End/FocalClick/models/focalclick](./Back-End/FocalClick/models/focalclick), and name it **segformerB3_S2_comb.pth**. Alternatively, from the root of the repo, just run `gdown https://drive.google.com/uc?id=1DkFun_tiw7z7RpjDtwqV65k1e9jxnLkr -O ./Back-End/FocalClick/models/focalclick/segformerB3_S2_comb.pth`
    - Download the Mask R-CNN from [here](<link>) and place it in [Back-End/Mask-RCNN](./Back-End/Mask-RCNN). The file has to be be named **model_RGB.pth**. This can also be done by simply running `wget -O ./Back-End/Mask-RCNN/model_RGB.pth "<link>?dl=1"` from the root of the repo.

## Running the application in the Chrome browser

### Starting the back-end
Navigate to the Back-End folder and run `uvicorn main:app --reload`.

### Starting the front-end
Run `npm start`. This command will start the front-end of the application. Then open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes to the front-end. You may also see any lint errors in the console.

## Annotation process
Negative clicks can be placed with a right-click, positive clicks are triggered with a left-click.