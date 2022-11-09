// taken from https://github.com/IsaacThaJunior/react-and-canvas-api/blob/main/src/Drawing.js

import { useEffect, useRef, useState } from 'react';
import './Canvas.css';
import axios from 'axios';

// TODO: connect point logic with the backend (removing previous point, removing all points)


export default function Canvas() {
    const canvasRef1 = useRef(null);
    const canvasRef2 = useRef(null);
	// Storing the context in a ref so we can use it
	// later to draw on the canvas
    const ctxRef1 = useRef(null);
    const ctxRef2 = useRef(null);
    
    // state to track the list of points
    const [points, setPoints] = useState([]);

    // state to track the current image
   const [currentImage, setCurrentImage] = useState(null);

   // offsets in x and y direction to center the image in the window
   const centerShift_x = useRef(null);
   const centerShift_y = useRef(null);


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

    useEffect(() => {
        if (!currentImage) {
            return;
        }
        // TODO: scale the image to make it fill the screen as much as possible
        console.log("drawing the new image")
        let canvas = canvasRef1.current;
        let ctx = ctxRef1.current;

        console.log(`width: ${currentImage.width}, height: ${currentImage.height}`)

        // TODO: figure out if I need to scale or not
        // need to divide by two in the end because the whole context was scaled by 2
        centerShift_x.current = ((canvas.width / 2) - currentImage.width) / 2;
        centerShift_y.current = ((canvas.height / 2) - currentImage.height) / 2;
        ctx.drawImage(currentImage, centerShift_x.current, centerShift_y.current);

        // // unscaled version with center shift
        // var centerShift_x = ((canvas.width / 2) - image.width);
        // var centerShift_y = ((canvas.height / 2) - image.height);
        // ctx.drawImage(image, centerShift_x, centerShift_y);

        // // unscaled version without center shift
        // ctx.drawImage(image, 0, 0);

        // // resizing canvas2, the upper canvas, so it only works on the image
        // let ctx2 = ctxRef1.current;
        // ctx2.canvas.width = image.width;
        // ctx2.canvas.height = image.height;
        // ctx2.canvas.style.top = centerShift_y;
        // ctx2.canvas.style.left = centerShift_x;
    }, [currentImage])

    const addPositivePoint = ({nativeEvent}) => {
        // TODO: solve this with an enum, not strings
        addPoint({nativeEvent}, "positive")
    }

    const addNegativePoint = ({nativeEvent}) => {
        // TODO: same as for positive point
        addPoint({nativeEvent}, "negative")
        return false;
    }

    const addPoint = ({nativeEvent}, typeOfClick) => {
        // extracting X and Y of the point and adding it to the list
        const { offsetX, offsetY } = nativeEvent;
        let x_relative_to_image = offsetX - centerShift_x.current;
        let y_relative_to_image = offsetY - centerShift_y.current;
        if (x_relative_to_image < currentImage.width && x_relative_to_image >= 0) {
            if (y_relative_to_image < currentImage.height && y_relative_to_image >= 0) {
                // point has been placed within the image and needs to be rendered on the frontend and send to the backend
                // using the relative coordinate to the image because that's what focal click needs
                const pointJson = {x: x_relative_to_image, y: y_relative_to_image, typeOfClick: typeOfClick};
                axios.post(
                    `http://localhost:8000/clicks/`, 
                    pointJson
                ).then(
                    response => {
                        console.log(response)
                    }
                );
                setPoints(prevPoints => {
                    return [...prevPoints, {x: x_relative_to_image, y: y_relative_to_image, typeOfClick:typeOfClick}];
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
        console.log(`drawing a point at ${x}, ${y} relative to the image`)
        ctxRef2.current.beginPath();
        /* x and y are relative to the upper left corner of the image, drawing however is relative to
        the full screen, therefore the center shifts need to be added*/
        ctxRef2.current.arc(x + centerShift_x.current, y + centerShift_y.current, 4, 0, 2 * Math.PI);
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
            console.log(`encoded image: ${reader.result.split(',')[1]}`)
            // reader.result contains the image in Base64 format; wrapping it in JSON to send it to the backend
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