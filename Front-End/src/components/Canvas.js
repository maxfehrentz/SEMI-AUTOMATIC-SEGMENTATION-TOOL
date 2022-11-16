import { useEffect, useRef, useState, useCallback } from 'react';
import './Canvas.css';
import axios from 'axios';

class ImageType {
    // Create new instances of the same class as static attributes
    static ImageToBeAnnotated = new ImageType("imageToBeAnnotated")
    static Mask = new ImageType("mask")

    constructor(name) {
      this.name = name
    }
  }

export default function Canvas() {
    const canvasRef1 = useRef(null);
    const canvasRef2 = useRef(null);
	// Storing the context in a ref so we can use it
	// later to draw on the canvas
    const ctxRef1 = useRef(null);
    const ctxRef2 = useRef(null);
    
    // state to track the list of points
    const [points, setPoints] = useState([]);

    // state to track the current image and by which factor it was scaled
   const [currentImage, setCurrentImage] = useState(null);
   const currentScale = useRef(null);

   // state to track the current mask; scale will be the same, if not there will be an exception
   const [currentMask, setCurrentMask] = useState(null);

   // offsets in x and y direction to center the image in the window
   const centerShiftX = useRef(null);
   const centerShiftY = useRef(null);


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
        
        // surpressing the contextMenu on right clicks; right clicks are used for negative clicks
        document.addEventListener("contextmenu", function(e) {
            e.preventDefault();       
        });


    }, []);

    // TODO: figure out how this works together with the scaling of context above; necessary for
    // functionality but fucks up layout!
    const doubleScreenDensitiy = canvas => {
        // For supporting computers with higher screen densities, we double the screen density
		canvas.width = window.innerWidth * 2;
		canvas.height = window.innerHeight * 2;
		canvas.style.width = `${window.innerWidth}px`;
		canvas.style.height = `${window.innerHeight}px`;
    }
    
    useEffect(() => {
        ctxRef2.current.clearRect(
			0,
			0,
			canvasRef2.current.width,
			canvasRef2.current.height
		);
        for (const point of points) {
           drawPoint(point)
        }
      }, [points])

    /* 
    can read up here https://www.knowledgehut.com/blog/web-development/all-about-react-usecallback
    why useCallback is necessary; basically: the useEffect hooks that need this function obviously
    have a dependency on it; however, functions get recreated at every rerender -> each rerender of
    the component would change this function and trigger the useEffect hook unitentionally
    -> useCallback makes sure that this function only gets recreated when one of its dependencies changes
    */
    const drawImageOnCanvas = useCallback((imageType) => {
        var canvas = null;
        var ctx = null;
        var imageToBeDrawn = null;
        if (imageType === ImageType.ImageToBeAnnotated) {
            canvas = canvasRef1.current;
            ctx = ctxRef1.current;
            imageToBeDrawn = currentImage;
        }
        else if (imageType === ImageType.Mask) {
            console.log("need to draw a mask");
            canvas = canvasRef2.current;
            ctx = ctxRef2.current;
            imageToBeDrawn = currentMask;
        }
        else {
            throw new Error("imageType is invalid!");
        }

        // scaling adapted from https://stackoverflow.com/questions/10841532/canvas-drawimage-scaling
        var naturalWidth = imageToBeDrawn.naturalWidth;
        var naturalHeight = imageToBeDrawn.naturalHeight;
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
        console.log("about to draw a mask")
        ctx.drawImage(imageToBeDrawn, 0, 0, naturalWidth, naturalHeight, centerShiftX.current, centerShiftY.current, imgWidth, imgHeight);

    }, [currentImage, currentMask])

    useEffect(() => {
        if (!currentImage) {
            return;
        }
        drawImageOnCanvas(ImageType.ImageToBeAnnotated)
    }, [currentImage, drawImageOnCanvas])


    useEffect(() => {
        console.log(`useEffect triggered`)
        if (!currentMask) {
            return;
        }
        drawImageOnCanvas(ImageType.Mask)
    }, [currentMask, drawImageOnCanvas])


    const addPositivePoint = ({nativeEvent}) => {
        // TODO: solve this with an enum, not strings
        addPoint({nativeEvent}, "positive")
    }

    const addNegativePoint = ({nativeEvent}) => {
        // TODO: same as for positive point
        addPoint({nativeEvent}, "negative")
    }

    const addPoint = ({nativeEvent}, typeOfClick) => {
        // extracting X and Y of the point
        const { x, y } = nativeEvent;

        /* a CSS stylesheet is used that changes the size of the canvas (Canvas.css) -> code in here is not
        aware of that -> takes coordinates as if the canvas size has not been changed by the stylesheet
        -> wrong coordinates; e.g. placing a click on the bottom of the canvas leads to the click 
        being localized much further up because the canvas was "squished" by the stylesheet;
        therefore, a translation relative to the actual box of the rendered canvas is necessary
        adapted from https://stackoverflow.com/questions/57910824/js-using-wrong-coordinates-when-drawing-on-canvas-with-margin
        */
        const canvas2 = canvasRef2.current;
        const rect = canvas2.getBoundingClientRect();
        // the height is divided by two because the canvas was scaled in the beginning by 2
        const factor = (canvas2.height / 2) / rect.height;
        const translatedY = factor * y;

        // TODO: change this to camel case
        let xRelativeToScaledImage = x - centerShiftX.current;
        /* see the corresponding CSS file: canvas1 with the image is restricted to 90% of the height now,
        while canvas2 is not and extends beyond the buttons because restricting canvas2 leads to a weird bug,
        painting the clicks where they were made leads to the points painted in a lower y position */
        let yRelativeToScaledImage = translatedY - centerShiftY.current;
        if (xRelativeToScaledImage < currentImage.naturalWidth * currentScale.current && xRelativeToScaledImage >= 0) {
            if (yRelativeToScaledImage < currentImage.naturalHeight * currentScale.current && yRelativeToScaledImage >= 0) {
                // sending the points relative to the UNSCALED image to the backend; scaling the image in the front-end is only for convenience;
                // the backend is oblivious to how the front-end displays the image
                const pointJson = {
                    x: xRelativeToScaledImage / currentScale.current, 
                    y: yRelativeToScaledImage / currentScale.current, 
                    typeOfClick: typeOfClick
                };
                axios.post(
                    `http://localhost:8000/clicks/`, 
                    pointJson
                ).then(
                    response => {
                        // expecting the mask in base64 format
                        console.log(response)
                        const currentMask = new Image();
                        console.log("created new Image")
                        currentMask.onload = function() {
                            console.log("setting current mask")
                            setCurrentMask(currentMask);
                        }
                        // need to prepend this so HTML knows how to deal with the base64 encoding
                        currentMask.src = "data:image/png;base64," + response.data;
                        console.log("set the mask src")
                    }
                );
                // saving the point to the list to be displayed
                setPoints(prevPoints => {
                    return [...prevPoints, {x: x, y: translatedY, typeOfClick:typeOfClick}];
                })
        
            }
            else {
                console.log("point is not in the y range of the image.")
            }
        }
        else {
            console.log("point is not in the x range of the image.")
        }
    }

    const clearMaskAndPoints = () => {
        setPoints(prevPoints => {
            return [];
        })
    }

    const clearPrevPoint = () => {
        setPoints(prevPoints => {
            return prevPoints.slice(0, -1);
        })
    }

	const drawPoint = ({x, y, typeOfClick}) => {
        ctxRef2.current.beginPath();
        /* x and y are relative to the upper left corner of the unscaled image, drawing however is relative to
        the full screen and the scaled image, therefore the center shifts need to be added*/
        ctxRef2.current.arc(x, y, 4, 0, 2 * Math.PI);
        if (typeOfClick === "positive") {
            ctxRef2.current.fillStyle = "#AAFF00";
        }
        else if (typeOfClick === "negative") {
            ctxRef2.current.fillStyle = "#FF0000";
        }
        else {
            console.log(typeOfClick)
            throw new Error("the type of this click is unknown!");
        }
        ctxRef2.current.fill();
	};

	const clearCanvas = () => {
        console.log("clearing the screen")
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
        setPoints(prevPoints => {
            return [];
        })
    };
    
    const loadImage = async () => {
        // removing everything
        clearCanvas();

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
            axios.put("http://localhost:8000/image", imageJson);
            setCurrentImage(image);
        })
    }

	return (
        <div className="fullScreen">
            <div className="canvasContainer">
	        	<canvas className="canvas1"
                    ref={canvasRef1}
	        	/>
                <canvas className="canvas2"
                    onClick={addPositivePoint}
                    onContextMenu={addNegativePoint}
                    ref={canvasRef2}
	        	/>
            </div>
	        <button className="button" onClick={clearMaskAndPoints}>
	        	Start from scratch
	        </button>
            <button className="button" onClick={clearPrevPoint}>
	        	Remove previous point
	        </button>
            <button className="button" onClick={loadImage}>
	        	Load image
	        </button>
        </div>
	);
}