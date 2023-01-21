FROM nvidia/cuda:11.6.2-cudnn8-devel-ubuntu18.04

# fix for changed keys found in https://github.com/NVIDIA/nvidia-docker/issues/1631
RUN rm /etc/apt/sources.list.d/cuda.list
RUN rm /etc/apt/sources.list.d/nvidia-ml.list
RUN apt-key del 7fa2af80
RUN apt-key adv --fetch-keys https://developer.download.nvidia.com/compute/cuda/repos/ubuntu1804/x86_64/3bf863cc.pub
RUN apt-key adv --fetch-keys https://developer.download.nvidia.com/compute/machine-learning/repos/ubuntu1804/x86_64/7fa2af80.pub

ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update && apt-get install -y \
	build-essential ca-certificates python3.8 python3.8-dev python3.8-distutils git wget sudo cmake curl libssl-dev
RUN ln -sv /usr/bin/python3.8 /usr/bin/python

# create a non-root user
# add group bertoglio
RUN groupadd -g 5011 bertoglio 
# add user fehrentz with groups bertoglio, create /home/fehrentz directory
RUN useradd -u 5011 -d /home/fehrentz -m -g 5011 --groups bertoglio
# RUN echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
USER fehrentz
WORKDIR /home/fehrentz

ENV PATH="/home/fehrentz/.local/bin:${PATH}"
RUN wget https://bootstrap.pypa.io/get-pip.py && \
	python get-pip.py --user && \
	rm get-pip.py

# install requirements for front-end
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
RUN source ~/.nvm/nvm.sh
RUN nvm install v14.20.1
RUN cd ../Front-End
RUN npm install
RUN cd ../docker
# install requirements for back-end
RUN pip install -r ../requirements.txt
# install detectron2
RUN git clone https://github.com/facebookresearch/detectron2 detectron2_repo
RUN pip install --user -e detectron2_repo
# download Mask R-CNN and segformer
RUN gdown https://drive.google.com/uc?id=1DkFun_tiw7z7RpjDtwqV65k1e9jxnLkr -O ../Back-End/FocalClick/models/focalclick/segformerB3_S2_comb.pth
RUN wget -O ../Back-End/Mask-RCNN/model_RGB.pth "https://www.dropbox.com/s/cxha1jozl544bmj/model_RGB.pth?dl=1"
# set FORCE_CUDA because during `docker build` cuda is not accessible
ENV FORCE_CUDA="1"
# This will by default build detectron2 for all common cuda architectures and take a lot more time,
# because inside `docker build`, there is no way to tell which architecture will be used.
ARG TORCH_CUDA_ARCH_LIST="Kepler;Kepler+Tesla;Maxwell;Maxwell+Tegra;Pascal;Volta;Turing"
ENV TORCH_CUDA_ARCH_LIST="${TORCH_CUDA_ARCH_LIST}"

# Set a fixed model cache directory.
ENV FVCORE_CACHE="/tmp"

# install linters
RUN pip install --user flake8
RUN pip install --user pylint

CMD ["bash"]
WORKDIR /exp

