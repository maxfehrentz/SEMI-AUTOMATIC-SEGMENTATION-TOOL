FROM nvidia/cuda:11.6.2-cudnn8-devel-ubuntu18.04

SHELL ["/bin/bash", "-c"]

ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update && apt-get install -y \
	build-essential ca-certificates python3.8 python3.8-dev python3.8-distutils git wget sudo cmake curl libssl-dev libgl1-mesa-glx libglib2.0-dev
RUN ln -sv /usr/bin/python3.8 /usr/bin/python

# create a non-root user
# add group fehrentz
RUN groupadd -g 6001 fehrentz
# add user fehrentz with groups fehrentz, create /home/fehrentz directory
RUN useradd -u 6001 -d /home/fehrentz -m -g 6001 fehrentz
# RUN echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
USER fehrentz
WORKDIR /home/fehrentz

ENV PATH="/home/fehrentz/.local/bin:${PATH}"
RUN wget https://bootstrap.pypa.io/get-pip.py && \
	python get-pip.py --user && \
	rm get-pip.py

# install node
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash && \
	source ~/.nvm/nvm.sh && \
	nvm install v14.20.1

# install requirements (except for detectron2) for the backend
COPY --chown=6001:6001 requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt
RUN rm requirements.txt

# Set a fixed model cache directory.
ENV FVCORE_CACHE="/tmp"

# install linters
RUN pip install --user flake8
RUN pip install --user pylint

CMD ["bash"]
WORKDIR /exp

