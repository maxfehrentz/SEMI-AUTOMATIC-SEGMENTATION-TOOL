#!/bin/bash

# Install Node.js and npm
cd ..
sudo apt-get update
sudo apt-get install build-essential libssl-dev
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
source ~/.nvm/nvm.sh
nvm install v14.20.1

# Create virtual environment
pip install virtualenv
apt install python3.8-venv
python3 -m venv ./venv
source venv/bin/activate

# Install backend requirements
pip install -r ./Docker/requirements.txt
git clone https://github.com/facebookresearch/detectron2.git
python -m pip install -e detectron2

# Install frontend requirements
cd Front-End
npm install

# Download required models
cd ..
gdown https://drive.google.com/uc?id=1DkFun_tiw7z7RpjDtwqV65k1e9jxnLkr -O ./Back-End/FocalClick/models/focalclick/segformerB3_S2_comb.pth
curl -L -o ./Back-End/Mask-RCNN/model_RGB.pth "https://www.dropbox.com/s/cxha1jozl544bmj/model_RGB.pth?dl=1"