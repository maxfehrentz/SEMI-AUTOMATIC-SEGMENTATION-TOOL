import { React, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './BoundingScreen.css';
import axios from 'axios';

/*
 TODO: figure out how to deal with all the code duplication (e.g. for loading the image; maybe those hooks
    can be generalized and moved to separate files)
 */
export default function SegmentationScreen() {

    const canvasRef1 = useRef(null);
    const canvasRef2 = useRef(null);
	// Storing the context in a ref so we can use it
	// later to draw on the canvas
    const ctxRef1 = useRef(null);
    const ctxRef2 = useRef(null);

    // track the current image and by which factor it was scaled
    const [currentImage, setCurrentImage] = useState(null);
    const currentScale = useRef(null);
 
    // track the bounding boxes
    const [boundingBoxes, setBoundingBoxes] = useState([]);
 
    // offsets in x and y direction to center the image in the window
    const centerShiftX = useRef(null);
    const centerShiftY = useRef(null);
 
    // tracking whether or not the user is drawing
    const isDrawing = useRef(false);
 
    // tracking the origin of a rect while drawing
    const originBoxX = useRef(null);
    const originBoxY = useRef(null);


    useEffect(() => {
        const canvas1 = canvasRef1.current;
        const canvas2 = canvasRef2.current;

        doubleScreenDensitiy(canvas1);
        doubleScreenDensitiy(canvas2);
        
        const ctx1 = canvas1.getContext('2d');
		ctx1.scale(2, 2);
        ctxRef1.current = ctx1;

        const ctx2 = canvas2.getContext('2d');
        ctx2.scale(2, 2);
        ctxRef2.current = ctx2;


    }, []);


    const doubleScreenDensitiy = canvas => {
        // For supporting computers with higher screen densities, we double the screen density
		canvas.width = window.innerWidth * 2;
		canvas.height = window.innerHeight * 2;
		canvas.style.width = `${window.innerWidth}px`;
		canvas.style.height = `${window.innerHeight}px`;
    }


    useEffect(() => {
        // TODO: differentiate between reset for segmentation and masks and reset for bounding boxes
        // create new endpoint for that (but isn't the reset already done automatically?)

        // axios.post(
        //     `http://localhost:8000/reset/`        
        // ).then(() => {
            if (!currentImage) {
                return;
            }
            const canvas = canvasRef1.current;
            const ctx = ctxRef1.current;
    
            // scaling adapted from https://stackoverflow.com/questions/10841532/canvas-drawimage-scaling
            var naturalWidth = currentImage.naturalWidth;
            var naturalHeight = currentImage.naturalHeight;
            var imgWidth = naturalWidth;
            var screenWidth  = canvas.width / 2;
            var scaleX = 1;
            scaleX = screenWidth/imgWidth;
            var imgHeight = naturalHeight;
            var screenHeight = canvas.height / 2;
            var scaleY = 1;
            scaleY = screenHeight/imgHeight;
            var scale = scaleY;
            if(scaleX < scaleY)
                scale = scaleX;
            currentScale.current = scale;
    
            imgHeight = imgHeight*scale;
            imgWidth = imgWidth*scale;
            // need to divide by two in the end because the whole canvas was scaled by 2
            centerShiftX.current = ((canvas.width / 2) - imgWidth) / 2;
            centerShiftY.current = ((canvas.height / 2) - imgHeight) / 2;
            ctx.drawImage(currentImage, 0, 0, naturalWidth, naturalHeight, centerShiftX.current, centerShiftY.current, imgWidth, imgHeight);
        // })
    }, [currentImage])


    useEffect(() => {

        clearCanvas2();

        const ctx = ctxRef2.current;
        ctx.strokeStyle = "red";

        for (const boundingBox of boundingBoxes) {
            const {x, y, width, height} = boundingBox;
            ctx.strokeRect(x, y, width, height);
        }
    }, [boundingBoxes])


	const clearEverything = () => {
		ctxRef1.current.clearRect(
			0,
			0,
			canvasRef1.current.width,
			canvasRef1.current.height
        );
        ctxRef2.current.clearRect(
			0,
			0,
			canvasRef2.current.width,
			canvasRef2.current.height
        );
        setCurrentImage(_ => {
            return null;
        })
        setBoundingBoxes(_ => {
            return [];
        })
    };


    const clearCanvas2 = () => {
        ctxRef2.current.clearRect(
			0,
			0,
			canvasRef2.current.width,
			canvasRef2.current.height
        );
    };
    

    const loadImage = async () => {
        // removing everything
        // TODO: find a cleaner solution to make this go hand-in-hand with the resets
        clearEverything();

        // TODO: make sure to accept only .jpeg, .png, .jpg
        let [fileHandle] = await window.showOpenFilePicker();
        const file = await fileHandle.getFile();

        const image = new Image();

        // adapted from https://www.educative.io/answers/how-to-build-an-image-preview-using-javascript-filereader
        const reader = new FileReader();
        // CONVERTS Image TO BASE 64
        reader.readAsDataURL(file);

        // setting the image when loaded and sending it to the backend
        reader.addEventListener("load", function () {

            image.src = reader.result;
            /* reader.result contains the image in Base64 format; removing some additional info and wrapping it in 
            JSON to send it to the backend */
            const imageJson = {content: reader.result.split(',')[1]};

            // sending the image to the backend
            axios.put("http://localhost:8000/bounding_image", imageJson).then(
                response => {
                    // TODO: check the status and do error handling
                    setBoundingBoxes(prevBoxes => {

                        // need to transform the format (x1,y1,x2,y2) for each array into (x1,y1,width,height)
                        const arrayOfBoxes = response.data
                        const transformedBoxes = []
                        for (const box of arrayOfBoxes) {
                            // coordinates are relative to the image, therefore adapting
                            // to scaling and shifts necessary
                            transformedBoxes.push({
                                x: box[0] * currentScale.current + centerShiftX.current, 
                                y: box[1] * currentScale.current + centerShiftY.current, 
                                width: (box[2] - box[0]) * currentScale.current,
                                height: (box[3] - box[1]) * currentScale.current
                            })
                        }
                        return prevBoxes.concat(transformedBoxes)
                    })
                }
            );
            setCurrentImage(image);
        })
    }

    const navigate = useNavigate();

    const continueToSegmentation = useCallback(() => navigate('/segmentation', {replace: true}), [navigate]);

    // need to adjust for squishing on the y-axis, see SegmentationScreen.js for more explanation on this
    // TODO: also implement this for x; there might be images wider than the screen at some point
    const translateY = (y) => {
        const canvas2 = canvasRef2.current;
        const rect = canvas2.getBoundingClientRect();
        // the height is divided by two because the canvas was scaled in the beginning by 2
        const factor = (canvas2.height / 2) / rect.height;
        const translatedY = factor * y;
        return translatedY
    }

    const startOrStopDrawingBox = ({nativeEvent}) => {
        if (isDrawing.current) {
            stopDrawingBox();
            isDrawing.current = false;
        }
        // only allow drawing if there is an image set
        else if (currentImage) {
            isDrawing.current = true;
            
            const {x, y} = nativeEvent;
            const translatedY = translateY(y);

            originBoxX.current = x;
            originBoxY.current = translatedY;

            // create entry in the bounding box list
            setBoundingBoxes(prevBoxes => {
                return [...prevBoxes, {x: x, y: translatedY, width: 0, height: 0}]
            })
        }
    }

    const stopDrawingBox = (() => {
        // TODO: add the box to the list of bounding boxes (also create that list as a state)
        originBoxX.current = null;
        originBoxY.current = null;
    })

    const drawBox = (({nativeEvent}) => {
        if ((!originBoxX.current && !originBoxY.current) || !isDrawing.current) {
            return;
        }
        const {x, y} = nativeEvent;
        const translatedY = translateY(y);

        setBoundingBoxes(prevBoxes => {
            const newBoxes = prevBoxes.slice(0, -1);
            newBoxes.push({x: originBoxX.current, y: originBoxY.current, width: x - originBoxX.current, height: translatedY - originBoxY.current});
            return newBoxes;
        })
    })


	return (
        <div className="fullScreen">
            <div className="canvasContainer">
	        	<canvas className="canvas1"
                    ref={canvasRef1}
	        	/>
                <canvas className="canvas2"
                    onClick={startOrStopDrawingBox}
                    onMouseMove={drawBox}
                    onMouseLeave={stopDrawingBox}
                    ref={canvasRef2}
	        	/>
            </div>
            <button className="button_bounding" onClick={loadImage}>
	        	Load image
	        </button>
            <button className="button_bounding" onClick={continueToSegmentation}>
	        	Continue to segmentation
	        </button>
        </div>
	);
}