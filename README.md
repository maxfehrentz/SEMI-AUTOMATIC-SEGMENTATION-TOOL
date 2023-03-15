# A Semi-Automatic Segmentation Tool

The tool in its current state works on grape bunch instance segmentation. It suggests masks and lets the user refine it via the iterative click-based method FocalClick.

## Installation on Linux and MacOS
The tool can be either installed by a script or by manually executing the commands. Make sure to use the Chrome browser and Python 3.8.

### Installation script
- Clone the repo.
- Navigate to the [Installation folder](./Installation). Execute the installation script for your platform. It assumes that basic software such as python, pip, or git is installed.

### Manual installation
- Clone the repo.
- Get Node.js and npm from https://nodejs.org/en/download/releases/. This project uses v14.20.1. To do this from the command line, run the following commands:
    - For Linux:
        - `sudo apt-get update` 
        - `sudo apt-get install build-essential libssl-dev`
    - For macOS:
        - `brew update`
        - `brew install openssl`
    - get and execute the nvm installation script with `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash`
    - `source ~/.nvm/nvm.sh`
    - this finally installs npm and Node.js v14.20.1: `nvm install v14.20.1`
- Create a virtual environment in the root folder.
    - For Linux: 
        - `sudo apt-get install python3.8-venv`
        - `python3.8 -m venv ./venv`
    - For macOS:
        - `pip install virtualenv`
        - `python3 -m venv ./venv`
    - `source venv/bin/activate`
- Execute `pip install -r ./Docker/requirements.txt` in the root folder to get the requirements for the back end listed in **requirements.txt**. For macOS or when not using a NVIDIA GPU, comment out the NVIDIA dependencies. They are only used on Linux for running the tool on a NVIDIA GPU. For both platforms, run `git clone https://github.com/facebookresearch/detectron2.git` and `python -m pip install -e detectron2` in the root folder.
- Run `npm install` in the [front end folder](./Front-End) to install all requirements for the frontend (defined in **package.json**).
- Download the models that are required
    - Download the segformer model for FocalClick from [here](https://drive.google.com/file/d/1DkFun_tiw7z7RpjDtwqV65k1e9jxnLkr/view?usp=share_link), place it in [Back-End/FocalClick/models/focalclick](./Back-End/FocalClick/models/focalclick), and name it **segformerB3_S2_comb.pth**. Alternatively, from the root of the repo, just run `gdown https://drive.google.com/uc?id=1DkFun_tiw7z7RpjDtwqV65k1e9jxnLkr -O ./Back-End/FocalClick/models/focalclick/segformerB3_S2_comb.pth`
    - Download the Mask R-CNN from [here](https://www.dropbox.com/s/cxha1jozl544bmj/model_RGB.pth?dl=0) and place it in [Back-End/Mask-RCNN](./Back-End/Mask-RCNN). The file has to be be named **model_RGB.pth**. This can also be done by simply running `curl -L -o ./Back-End/Mask-RCNN/model_RGB.pth "https://www.dropbox.com/s/cxha1jozl544bmj/model_RGB.pth?dl=1"` from the root of the repo.

## Running the application in the Chrome browser

### Creating a self-signed certificate
In order for some functionalities to work, HTTPS is required. To run the application with the HTTPS protocol, create a self-signed certificate. Run the following commands in the root folder:
- `mkdir ssl`
- `cd ssl`
- `openssl genpkey -algorithm RSA -out private.key -aes256`
- `openssl req -new -x509 -key private.key -out selfsigned.crt`
- `openssl rsa -in private.key -out private-without-passphrase.key`

Note that you have to pick a passphrase for the initial private key.

### Starting the back end
Activate the virtual environment in the root folder with `source venv/bin/activate`. Navigate to the [API folder](./Back-End/API) and run `uvicorn main:app --host 0.0.0.0 --ssl-keyfile ../../ssl/private-without-passphrase.key --ssl-certfile ../../ssl/selfsigned.crt`. Note that depending on whether you want to run the tool on GPU or CPU, the torch.device needs to be adjusted accordingly in **main.py** in the [API folder](./Back-End/API).

### Starting the front end
Run `HTTPS=true SSL_CRT_FILE=../ssl/selfsigned.crt SSL_KEY_FILE=../ssl/private-without-passphrase.key npm start` in the [front end folder](./Front-End). Then open [https://localhost:3000](https://localhost:3000) to view it in your browser.

### Running the tool on a server
Note that the React front end will run on port 3000 and the python back end will run on port 8000 by default. FiftyOne uses port 5151. In case the tool does not run on the local machine but on a server, one option is to use port forwarding. Instead of connecting via `ssh user@server-address`, use `ssh -L 3000:localhost:3000 -L 5151:localhost:5151 -L 8000:localhost:8000 user@server-address`. Then the tool can be accessed via [https://localhost:3000](https://localhost:3000).
Another option without port forwarding is to connect to the server by using its IP address, so via [https://IP:3000](https://IP:3000).
In case you want to run front end and back end in the same docker container on a server, it is necessary to publish those ports as well, so make sure to include `-p 3000:3000 -p 5151:5151 -p 8000:8000` when starting the container.

## User manual
### Annotation process
1) Start the annotation process.
![Start screen](./supplementary/start.png)
2) Press "Load Image(s)" and pick one or more images you want to annotate. Tipp: a version of the WGISD can be downloaded [here](https://github.com/thsant/wgisd).
3) The images are loaded and bounding box suggestions are being prepared.
![Bounding screen](./supplementary/bounding.png)
4) After the loading process is done, the suggested bounding boxes (if there are any) are displayed. You can now
    - draw new bounding boxes by placing a left click, drawing the box, and placing another left click to finish the annotation.
    - edit bounding boxes by hovering over a bounding box and placing a right click. An editor menu will open, where you can either delete, move, or rescale the box. When moving the box, the box will lock in place upon the next left click. For rescaling a box, click on one of the four highlighted corners to adjust and click left again to finish the rescaling.
    - note that all box drawings require an **initial** click and an **ending** click. Between those, you can move the mouse freely, **do not** hold the left click while drawing.
5) When the bounding boxes are satisfactory, you can continue to segmentation by pressing "Continue to segmentation". Each bounding box content will be displayed and can be segmented. If a suggested bounding box was correct and in no way altered, there is also going to be a mask suggestion displayed. Note the two bars on top of the image: with the upper one you can control the brightness of the image, the lower one regulates the opacity of the mask. To edit the mask, place positive clicks with left clicks and negative clicks with right clicks. When starting without a mask suggestion it is recommended to start by placing a positive click in the middle of the desired object. When starting from an existing mask, simply add positive clicks where mask is missing and add negative clicks where mask is too much. Place them in the center of the area to be added/removed. The buttons on the bottom allow to either start from scratch, roll back the previous click, or move on to the next bounding box to be segmented.
![Segmentation screen](./supplementary/segmentation.png)
6) When all segmentations are done for one image and several images were chosen in the beginning, the tool will return to 4.
7) When all segmentations are done for all images, the annotations can be saved in a desired format (currently only COCO supported). Moreover, a separate window will open, visualizing the annotations. If the window does not open automatically, connect to [https://localhost:5151](https://localhost:5151) or [https://IP:5151](https://IP:5151), depending on where the tool is running.


### Visualizing the annotations at a later point in time
If you want to visualize annotations in a COCO-formated JSON file at a later point in time, you can use the script **visualization.py** in the [evaluation folder](./Eval_scripts). However, there is a catch. Sometimes, the JSON file refers to the image names, without giving a path where to find them (Option A), sometimes there is a relative path given (Option B). Our tool for example can only write the image name to the JSON file because your local images are uploaded to the browser; for privacy reasons, browsers are never provided with local system paths, only filenames. The visualization script can be used for both options.
- If Option A applies to your JSON file (only filenames), run **visualization.py** from the command line with two arguments: the path to the JSON file, then the path the folder where to find the images.
- If Option B applies to your JSON file (filenames are given as relative paths) **and the JSON file is actually positioned like this relative to the images**, it is sufficient to run **visualization.py** from the command line passing only the path to the JSON file. If the JSON file is not positioned correctly for the relative paths to lead to the images, use the procedure for Option A.


### Evaluating annnotations against a ground truth
To evaluate one or more COCO-formated annotations against a ground truth file, run **evaluation.py** from the [evaluation folder](./Eval_scripts) on your command line, simply passing the path to the ground truth JSON file, then passing the path(s) to your annotation(s).
To visually compare the ground truth against your annotation, use **gt_analysis.py** from the [evaluation folder](./Eval_scripts). Run the script and pass three arguments: the path to the ground truth, the path to your annotation, and the path to the image folder. This will visualize the annotations in FiftyOne.


## Fine-tuning
This will not work out of the box. Change the model and the data sets by modifying **config.yml** in the [FocalClick folder](./Back-End/FocalClick) and **segformerB3_S2_comb.py** in [this folder](./Back-End/FocalClick/models/focalclick). Moreover, additional dependencies and code changes might be necessary to accomodate for different GPUs. Currently, the dependencies in **requirements.txt** are specific for Linux for a NVIDIA GPU.
Then, to fine-tune the SegFormer within FocalClick, run `python Back-End/FocalClick/finetune.py Back-End/FocalClick/models/focalclick/segformerB3_S2_comb.py --gpus 0 --workers 5 --batch-size=32` from the root of the project. This runs the fine-tuning on the GPU with ID 0. The arguments are explained in further detail in **finetune.py**.


## Comments 

### Visualization with FiftyOne
There seems to be a bug that some images do not get rendered. Apparently, it does not work with .jpg files larger than 1 MB. You can follow the issue on Github [here](https://github.com/voxel51/fiftyone/issues/1750).

### Debugging
If you are experiencing difficulties or suspicious behavior, you can check your terminal where the back end is running and the console of your browser for errors.