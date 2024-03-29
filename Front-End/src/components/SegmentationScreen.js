import { React, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './SharedStyles.css';
import './SegmentationScreen.css';
import axios from 'axios';
import { useParams } from 'react-router-dom';

// taken from https://mui.com/material-ui/
import Slider from '@mui/material/Slider';


export default function SegmentationScreen() {

    // retrieving the state held throughout the navigation, will eventually be passed back to the bounding box screen
    const location = useLocation();
    const state = location.state;

    // this accesses the parameteres that were passed while navigating from the previous screen
    const params = useParams();
    // ids of segments passed from the previous screen
    const ids = params.ids.split(",");

    /*
    tracking the current segment; the index will move through the array of ids, retrieving the ids
    over time while the user annotates the individual segments
    */
    const [currentIndex, setCurrentIndex] = useState(0);

    const canvasRef1 = useRef(null);
    const canvasRef2 = useRef(null);
    const ctxRef1 = useRef(null);
    const ctxRef2 = useRef(null);

    // state to enable/disable the rollback button; we only allow to rollback one step
    const [rollbackDisabled, setRollbackDisabled] = useState(true);

    // state to enable/disable the next segment button; we only allow to go further when the backend is ready
    const [nextDisabled, setNextDisabled] = useState(false);

    // state to show loading animation 
    const [loading, setLoading] = useState(false);
    
    // state to track the list of points
    const [points, setPoints] = useState([]);

    // state to track the current image and by which factor it was scaled
   const [currentImage, setCurrentImage] = useState(null);
   const currentScale = useRef(null);
   // 100% is the standard inherent image brightness
   const [brightness, setBrightness] = useState(100); 

   // state to track the current mask; scale will be the same, if not there will be an exception
   const [currentMask, setCurrentMask] = useState(null);
   // opacity of the mask
   const [opacity, setOpacity] = useState(75);

   // state to track the text on the button to proceeds between segments
   const [lastSegment, setLastSegment] = useState(false);
   const initialProceedButtonText = "Next segment";
   const finalProceedButtonText = "Finish segmentations";
   const [proceedButtonText, setProceedButtonText] = useState(initialProceedButtonText);

   // navigation
   const navigate = useNavigate();

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

    useEffect(() => {
        if (lastSegment) {
            setProceedButtonText(finalProceedButtonText);
        }
        else {
            setProceedButtonText(initialProceedButtonText);
        }
    }, [lastSegment]);


    const doubleScreenDensitiy = canvas => {
        // For supporting computers with higher screen densities, we double the screen density
		canvas.width = window.innerWidth * 2;
		canvas.height = window.innerHeight * 2;
		canvas.style.width = `${window.innerWidth}px`;
		canvas.style.height = `${window.innerHeight}px`;
    }

    
    useEffect(() => {

        /* 
        when the user works on the last segment (currentIndex is the last index in the ids array), we want
        to display another text, because by pressing "next" he will finish the segmentation for this image
        */
        if (currentIndex === ids.length - 1) {
            setLastSegment(true);
        }

        /*
        the current index indexes into the ids array, basically pointing at the current segment id;
        when all segments are done, the currentIndex will be equal to the length of the ids array and it is done
        */
        if (currentIndex === ids.length) {
            return
        }

        const id = ids[currentIndex];

        axios.get(
            `https://${window.location.hostname}:8000/segments/${id}`
        ).then(response => {
            // excepting the image segment and optionally a suggested mask
            const currentMask = new Image();
            const currentImage = new Image();

            // clean up the screen and reset everything
            clearCanvas();

            currentMask.onload = function() {
                setRollbackDisabled(true);
                setCurrentMask(currentMask);
            }

            currentImage.onload = function() {
                setCurrentImage(currentImage);
            }

            // need to prepend this so HTML knows how to deal with the base64 encoding
            const prefix = "data:image/png;base64,"
            currentImage.src = prefix + response.data[0];
            currentMask.src = prefix + response.data[1];

        }).catch(error => {
            if (error.response.status === 404) {
                // that means that the requested resource was not available
                throw Error(`There is no segment with the id ${id}`);
            }
        });
    }, [currentIndex])
    

    useEffect(() => {
        ctxRef2.current.clearRect(
			0,
			0,
			canvasRef2.current.width,
			canvasRef2.current.height
        );
        // avoids that the user can remove a click before even placing one
        if(points.length === 0) {
            setRollbackDisabled(true)
        }
        for (const point of points) {
           drawPoint(point)
        }
      }, [points, opacity])


    useEffect(() => {
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
        ctx.filter = `brightness(${brightness}%)`;
        ctx.drawImage(currentImage, 0, 0, naturalWidth, naturalHeight, centerShiftX.current, centerShiftY.current, imgWidth, imgHeight);
    }, [currentImage, brightness])


    useEffect(() => {
        if (!currentMask) {
            return;
        }
        const ctx = ctxRef2.current;
        ctx.filter = `opacity(${opacity}%)`;
        ctx.drawImage(
            currentMask, 
            0, 
            0, 
            currentMask.naturalWidth, 
            currentMask.naturalHeight, 
            centerShiftX.current, 
            centerShiftY.current, 
            currentMask.naturalWidth * currentScale.current, 
            currentMask.naturalHeight * currentScale.current
        );
    }, [currentMask, opacity])


    const addPositivePoint = ({nativeEvent}) => {
        addPoint({nativeEvent}, "positive")
    }


    const addNegativePoint = ({nativeEvent}) => {
        addPoint({nativeEvent}, "negative")
    }


    const addPoint = ({nativeEvent}, typeOfClick) => {

        // extracting X and Y of the point
        const { x, y } = nativeEvent;

        /* a CSS stylesheet is used that changes the size of the canvas (see corresponding .css file) -> code in 
        here is not aware of that -> takes coordinates as if the canvas size has not been changed by the stylesheet
        -> wrong coordinates; e.g. placing a click on the bottom of the canvas leads to the click 
        being localized much further up because the canvas was "squished" by the stylesheet;
        therefore, a translation relative to the actual box of the rendered canvas is necessary
        adapted from https://stackoverflow.com/questions/57910824/js-using-wrong-coordinates-when-drawing-on-canvas-with-margin
        */
        const canvas2 = canvasRef2.current;
        const rect = canvas2.getBoundingClientRect();
        // the mouse is relative to the whole screen; therefore there is an offset caused by the sliders on top
        const offsetY = rect.y;
        // the height is divided by two because the canvas was scaled in the beginning by 2
        const factor = (canvas2.height / 2) / rect.height;
        const translatedY = factor * (y - offsetY);

        const xRelativeToScaledImage = x - centerShiftX.current;
        /* see the corresponding CSS file: canvas1 with the image is restricted to 90% of the height now,
        while canvas2 is not and extends beyond the buttons because restricting canvas2 leads to a weird bug,
        painting the clicks where they were made leads to the points painted in a lower y position */
        const yRelativeToScaledImage = translatedY - centerShiftY.current;

        if (xRelativeToScaledImage < currentImage.naturalWidth * currentScale.current && xRelativeToScaledImage >= 0) {
            if (yRelativeToScaledImage < currentImage.naturalHeight * currentScale.current && yRelativeToScaledImage >= 0) {
                // sending the points relative to the UNSCALED image to the backend; scaling the image in the front-end is only for convenience;
                // the backend is oblivious to how the front-end displays the image
                const pointJson = {
                    x: xRelativeToScaledImage / currentScale.current, 
                    y: yRelativeToScaledImage / currentScale.current, 
                    type_of_click: typeOfClick
                };

                // show loading animation
                setLoading(true);

                // communicate click to backend
                axios.post(
                    `https://${window.location.hostname}:8000/clicks/`,
                    pointJson
                ).then(
                    response => {
                        // expecting the mask in base64 format
                        const currentMask = new Image();
                        currentMask.onload = function() {
                            setCurrentMask(currentMask);
                            // can stop loading, new mask will be displayed
                            setLoading(false);
                            if (rollbackDisabled) {
                                setRollbackDisabled(false);
                            }
                        }
                        // need to prepend this so HTML knows how to deal with the base64 encoding
                        currentMask.src = "data:image/png;base64," + response.data;
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


    // used when the user wants to start from scratch
    const clearMaskAndPoints = () => {
        // first, notify the backend to reset the mask
        axios.post(
            `https://${window.location.hostname}:8000/reset-segmentation/`
        ).then(() => {
            setPoints(prevPoints => {
                return [];
            })
            setCurrentMask(null);
            setRollbackDisabled(true);
        })
    }

    const rollbackPrevClick = () => {
        axios.get(
            `https://${window.location.hostname}:8000/rollBackClick/`
        ).then(response => {
            // expecting the previous mask in base64 format
            const currentMask = new Image();
            currentMask.onload = function() {
                // remove the last click
                setPoints(prevPoints => {
                    return prevPoints.slice(0, -1);
                })
                setCurrentMask(currentMask);
                setRollbackDisabled(true);
            }
            // need to prepend this so HTML knows how to deal with the base64 encoding
            currentMask.src = "data:image/png;base64," + response.data;
        }).catch(error => {
            if (error.response.status === 404) {
                /* 
                that means that the requested resource (previous mask) was not available
                -> can happen if the user tries to rollback after the first click (no prev mask yet)
                -> this case is equal in meaning to starting from scratch
                */
                clearMaskAndPoints()
            }
        });
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
        setCurrentImage(_ => {
            return null;
        })
        setCurrentMask(_ => {
            return null;
        })
    };


    const nextSegment = () => {
        // disable button until backend is ready to continue
        setNextDisabled(true);
        axios.post(`https://${window.location.hostname}:8000/mask-finished/${ids[currentIndex]}`).then(_ => {
            // tell the backend to reset clicks and mask
            axios.post(
                `https://${window.location.hostname}:8000/reset-segmentation/`
            ).then(() => {
                if(lastSegment) {
                    navigate("/bounding", { state: state });
                }
                else {
                    setCurrentIndex(prevIndex => {return prevIndex + 1});
                    setNextDisabled(false)
                }
            })
        })
    }


    const brightnessChanged = (_, newValue) => {
        setBrightness(newValue);
    }


    const opacityChanged = (_, newValue) => {
        setOpacity(newValue);
    }


	return (
        <div className="fullScreen">
            {/* taken from https://stackabuse.com/how-to-create-a-loading-animation-in-react-from-scratch/ */}
            {loading &&
            <div className="loader-container">
                <div className="spinner"></div>
            </div>   
            } 
            <div className = "sliderContainer">
                <Slider
                    onChangeCommitted={brightnessChanged}
                    orientation="horizontal"
                    defaultValue={100}
                    min={25}
                    max={175}
                    aria-label="brightness"
                    valueLabelDisplay="off"
                />
                <Slider
                    onChangeCommitted={opacityChanged}
                    orientation="horizontal"
                    defaultValue={50}
                    min={0}
                    max={100}
                    aria-label="opacity"
                    valueLabelDisplay="off"
                />
            </div>
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
	        <button className="button_segmentation" onClick={clearMaskAndPoints}>
	        	Start from scratch
	        </button>
            <button className="button_segmentation" onClick={rollbackPrevClick} disabled={rollbackDisabled}>
	        	Remove previous point
	        </button>
            <button className="button_segmentation" onClick={nextSegment} disabled={nextDisabled}>
	        	{proceedButtonText}
	        </button>
        </div>
	);
}