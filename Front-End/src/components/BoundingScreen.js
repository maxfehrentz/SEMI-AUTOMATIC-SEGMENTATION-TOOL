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


    // const addPoint = ({nativeEvent}, typeOfClick) => {
    //     // extracting X and Y of the point
    //     const { x, y } = nativeEvent;

    //     /* a CSS stylesheet is used that changes the size of the canvas (Canvas.css) -> code in here is not
    //     aware of that -> takes coordinates as if the canvas size has not been changed by the stylesheet
    //     -> wrong coordinates; e.g. placing a click on the bottom of the canvas leads to the click 
    //     being localized much further up because the canvas was "squished" by the stylesheet;
    //     therefore, a translation relative to the actual box of the rendered canvas is necessary
    //     adapted from https://stackoverflow.com/questions/57910824/js-using-wrong-coordinates-when-drawing-on-canvas-with-margin
    //     */
    //     const canvas2 = canvasRef2.current;
    //     const rect = canvas2.getBoundingClientRect();
    //     // the height is divided by two because the canvas was scaled in the beginning by 2
    //     const factor = (canvas2.height / 2) / rect.height;
    //     const translatedY = factor * y;

    //     let xRelativeToScaledImage = x - centerShiftX.current;
    //     /* see the corresponding CSS file: canvas1 with the image is restricted to 90% of the height now,
    //     while canvas2 is not and extends beyond the buttons because restricting canvas2 leads to a weird bug,
    //     painting the clicks where they were made leads to the points painted in a lower y position */
    //     let yRelativeToScaledImage = translatedY - centerShiftY.current;
    //     if (xRelativeToScaledImage < currentImage.naturalWidth * currentScale.current && xRelativeToScaledImage >= 0) {
    //         if (yRelativeToScaledImage < currentImage.naturalHeight * currentScale.current && yRelativeToScaledImage >= 0) {
    //             // sending the points relative to the UNSCALED image to the backend; scaling the image in the front-end is only for convenience;
    //             // the backend is oblivious to how the front-end displays the image
    //             const pointJson = {
    //                 x: xRelativeToScaledImage / currentScale.current, 
    //                 y: yRelativeToScaledImage / currentScale.current, 
    //                 typeOfClick: typeOfClick
    //             };
    //             axios.post(
    //                 `http://localhost:8000/clicks/`, 
    //                 pointJson
    //             ).then(
    //                 response => {
    //                     // expecting the mask in base64 format
    //                     const currentMask = new Image();
    //                     currentMask.onload = function() {
    //                         setCurrentMask(currentMask);
    //                         if (rollbackDisabled) {
    //                             setRollbackDisabled(false);
    //                         }
    //                     }
    //                     // need to prepend this so HTML knows how to deal with the base64 encoding
    //                     currentMask.src = "data:image/png;base64," + response.data;
    //                 }
    //             );
    //             // saving the point to the list to be displayed
    //             setPoints(prevPoints => {
    //                 return [...prevPoints, {x: x, y: translatedY, typeOfClick:typeOfClick}];
    //             })
        
    //         }
    //         else {
    //             console.log("point is not in the y range of the image.")
    //         }
    //     }
    //     else {
    //         console.log("point is not in the x range of the image.")
    //     }
    // }


	// const drawPoint = ({x, y, typeOfClick}) => {
    //     ctxRef2.current.beginPath();
    //     /* x and y are relative to the upper left corner of the unscaled image, drawing however is relative to
    //     the full screen and the scaled image, therefore the center shifts need to be added*/
    //     ctxRef2.current.arc(x, y, 4, 0, 2 * Math.PI);
    //     if (typeOfClick === "positive") {
    //         ctxRef2.current.fillStyle = "#AAFF00";
    //     }
    //     else if (typeOfClick === "negative") {
    //         ctxRef2.current.fillStyle = "#FF0000";
    //     }
    //     else {
    //         console.log(typeOfClick)
    //         throw new Error("the type of this click is unknown!");
    //     }
    //     ctxRef2.current.fill();
	// };

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
            // TODO: connect this somehow to the backend
            // axios.put("http://localhost:8000/image", imageJson);
            setCurrentImage(image);
        })
    }

    const navigate = useNavigate();

    const continueToSegmentation = useCallback(() => navigate('/segmentation', {replace: true}), [navigate]);

    const startOrStopDrawingBox = ({nativeEvent}) => {
        if (isDrawing.current) {
            stopDrawingBox();
            isDrawing.current = false;
        }
        // only allow drawing if there is an image set
        else if (currentImage) {
            isDrawing.current = true;
            const {x, y} = nativeEvent;
            originBoxX.current = x;
            originBoxY.current = y;
            // create entry in the bounding box list
            setBoundingBoxes(prevBoxes => {
                return [...prevBoxes, {x: x, y: y, width: 0, height: 0}]
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
        setBoundingBoxes(prevBoxes => {
            const newBoxes = prevBoxes.slice(0, -1);
            newBoxes.push({x: originBoxX.current, y: originBoxY.current, width: x - originBoxX.current, height: y - originBoxY.current});
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