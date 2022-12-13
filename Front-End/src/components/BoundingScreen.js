import { React, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SharedStyles.css';
import './BoundingScreen.css';
import axios from 'axios';

// for details see https://szhsin.github.io/react-menu/
import { ControlledMenu, MenuItem, useMenuState } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import '@szhsin/react-menu/dist/transitions/slide.css';

// taken from https://mui.com/material-ui/
import Slider from '@mui/material/Slider';


/*
 TODO: figure out how to deal with all the code duplication (e.g. for loading the image; maybe those hooks
    can be generalized and moved to separate files)
 */
export default function BoundingScreen() {

    const canvasRef1 = useRef(null);
    const canvasRef2 = useRef(null);
	// Storing the context in a ref so we can use it
	// later to draw on the canvas
    const ctxRef1 = useRef(null);
    const ctxRef2 = useRef(null);

    // state that indicates whether the user has to wait for a response from the backend
    const [loading, setLoading] = useState(false);

    // track the current image, by which factor it was scaled, and the brightness
    const [currentImage, setCurrentImage] = useState(null);
    const currentScale = useRef(null);
    // 100% is the standard inherent image brightness
    const [brightness, setBrightness] = useState(100); 
 
    // track the bounding boxes
    const [boundingBoxes, setBoundingBoxes] = useState([]);

    // track which ids are available
    const availableId = useRef(0);
 
    // offsets in x and y direction to center the image in the window
    const centerShiftX = useRef(null);
    const centerShiftY = useRef(null);
 
    // tracking whether or not the user is drawing
    const isDrawing = useRef(false);

    // tracking whether or not the user is moving a box and which one; null represents that no movement atm
    const indexOfMovingBox = useRef(null);

    // tracking which box is being rescaled and where
    const [indexOfScalingBox, setIndexOfScalingBox] = useState(null);
    // those four Refs will store the corner coordinates for comparison with a click later on
    const topLeft = useRef(null);
    const topRight = useRef(null);
    const bottomLeft = useRef(null);
    const bottomRight = useRef(null);
    // values: "topleft", "topright", "bottomleft", "bottomright"
    // TODO: solve this more elegantly
    const cornerOfScalingBox = useRef(null);

    // tracking which box the user is hovering over
    const [highlightedId, setHighlightedId] = useState(null);
 
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
            // value ranges from 25% to 175%; 100% is normal
            ctx.filter = `brightness(${brightness}%)`;
            ctx.drawImage(currentImage, 0, 0, naturalWidth, naturalHeight, centerShiftX.current, centerShiftY.current, imgWidth, imgHeight);
        // })
    }, [currentImage, brightness])


    useEffect(() => {
        clearCanvas2();

        const ctx = ctxRef2.current;
        ctx.strokeStyle = "red";

        for (const boundingBox of boundingBoxes) {
            const {x, y, width, height, id} = boundingBox;
            ctx.strokeRect(x, y, width, height);
        }
    }, [boundingBoxes])


    useEffect(() => {
        clearCanvas2();

        // getting the context of the canvas
        const ctx = ctxRef2.current;
        ctx.strokeStyle = "red";

        for (const boundingBox of boundingBoxes) {
            // simply drawing the bounding box again
            ctx.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);

            // if it is the bounding box that is being hovered over, fill it with transparent red color
            if (boundingBox.id === highlightedId) {

                // if the user is rescaling, highlight the corners of the highlighted box
                if(indexOfScalingBox !== null) {
                    // TODO: move those constants into a separate constants file
                    const radius = 5;
                    ctx.fillStyle = "rgba( 255, 0, 0, 0.6 )";
                    
                    ctx.beginPath();
                    console.log(`top left x: ${topLeft.current.x}`);
                    console.log(`top left y: ${topLeft.current.y}`);
                    ctx.arc(topLeft.current.x, topLeft.current.y, radius, 0, 2 * Math.PI, false);
                    ctx.fill();
                    
                    ctx.beginPath();
                    console.log(`top right x: ${topRight.current.x}`);
                    console.log(`top right y: ${topRight.current.y}`);
                    ctx.arc(topRight.current.x, topRight.current.y, radius, 0, 2 * Math.PI, false);
                    ctx.fill();
                    
                    ctx.beginPath();
                    ctx.arc(bottomLeft.current.x, bottomLeft.current.y, radius, 0, 2 * Math.PI, false);
                    ctx.fill();
                    
                    ctx.beginPath();
                    ctx.arc(bottomRight.current.x, bottomRight.current.y, radius, 0, 2 * Math.PI, false);
                    ctx.fill();
                    
                }

                ctx.fillStyle = "rgba( 255, 0, 0, 0.3 )";

            }
            else {
                ctx.fillStyle = "transparent";
            }

            ctx.fillRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
        }

    }, [highlightedId, indexOfScalingBox])


    /* 
    TODO: unclear when stuff is "cleared", "resetted", etc.; make this better and settle on a
    convention where cleaning is happening, e.g. only in hooks, only in custom functions, ...?
    */
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
        availableId.current = 0;
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

            setLoading(true);

            // sending the image to the backend and receive the bounding boxes
            axios.put("http://localhost:8000/bounding-image", imageJson).then(
                response => {
                    // TODO: check the status and do error handling
                    setBoundingBoxes(prevBoxes => {

                        // need to transform the format (x1,y1,x2,y2,identifier) (x1,y1,width,height,identifier)
                        const arrayOfBoxes = response.data
                        var newBoxes = [];
                        for (const box of arrayOfBoxes) {
                            // coordinates are relative to the image, therefore adapting
                            // to scaling and shifts necessary
                            // TODO: bounding boxes are very narrow, maybe scale them by some factor like 1.1?
                            newBoxes.push(
                                {
                                x: (box[0] * currentScale.current + centerShiftX.current), 
                                y: (box[1] * currentScale.current + centerShiftY.current), 
                                width: (box[2] - box[0]) * currentScale.current,
                                height: (box[3] - box[1]) * currentScale.current,
                                id: box[4]
                                }
                            );
                        }
                        /* 
                        TODO: this will only work if the user cannot create boxes already during loading of the
                        mask rcnn boxes
                        */
                        newBoxes = prevBoxes.concat(newBoxes);
                        availableId.current = newBoxes.length;

                        // loading can stop
                        setLoading(false);

                        return [...newBoxes];
                    })
                }
            );
            setCurrentImage(image);
        })
    }

    const navigate = useNavigate();

    // need to adjust for squishing on the y-axis, see SegmentationScreen.js for more explanation on this
    // also need to adjust for the offset on the y-axis caused by the slider on top!
    // TODO: also implement this for x; there might be images wider than the screen at some point
    const translateY = (y) => {
        const canvas2 = canvasRef2.current;
        const rect = canvas2.getBoundingClientRect();
        // mouse is relative to the whole screen while we need it to be relative to the image canvas
        const yOffset = rect.y;
        // the height is divided by two because the canvas was scaled in the beginning by 2
        const factor = (canvas2.height / 2) / rect.height;
        const translatedY = factor * (y - yOffset);
        return translatedY
    }

    const onLeftClick = ({nativeEvent}) => {
        const {x, y} = nativeEvent;
        const translatedY = translateY(y);

        // TODO: make sure that user cannot draw outside of the image
        if (isDrawing.current) {
            stopDrawingBox();
            isDrawing.current = false;
        }
        else if (indexOfMovingBox.current !== null) {
            // this process was started by chosing "Move" in the right click custom context menu
            // the left click now stops the movement
            indexOfMovingBox.current = null;
        }
        else if (indexOfScalingBox !== null) {
            // if the user already chose a corner before, this second click finishes the process
            // TODO: this is duplicate code from the else statement below, maybe move
            if(cornerOfScalingBox.current !== null) {
                setIndexOfScalingBox(null);
                cornerOfScalingBox.current = null;
                topLeft.current = null;
                topRight.current = null;
                bottomLeft.current = null;
                bottomRight.current = null;
                return;
            }

            // the process was started by chosing "Scale" in the right click custom context menu
            // checking if the user clicked close to one of the corners
            // TODO: move tolerance to a constant file
            const tolerance = 10;
            if(-tolerance < x - topLeft.current.x && 
                x - topLeft.current.x < tolerance &&
                -tolerance < translatedY - topLeft.current.y &&
                translatedY - topLeft.current.y < tolerance) {
                // user clicked on the topleft corner
                cornerOfScalingBox.current = "topLeft";
            }
            else if(-tolerance < x - topRight.current.x && 
                x - topRight.current.x < tolerance &&
                -tolerance < translatedY - topRight.current.y &&
                translatedY - topRight.current.y < tolerance) {
                // user clicked on the topright corner
                cornerOfScalingBox.current = "topRight";
            }
            else if(-tolerance < x - bottomLeft.current.x && 
                x - bottomLeft.current.x < tolerance &&
                -tolerance < translatedY - bottomLeft.current.y &&
                translatedY - bottomLeft.current.y < tolerance) {
                // user clicked on the bottom left corner
                cornerOfScalingBox.current = "bottomLeft";
            }
            else if(-tolerance < x - bottomRight.current.x && 
                x - bottomRight.current.x < tolerance &&
                -tolerance < translatedY - bottomRight.current.y &&
                translatedY - bottomRight.current.y < tolerance) {
                // user clicked on the bottom right corner
                cornerOfScalingBox.current = "bottomRight";
            }
            else {
                // the user clicked somewhere else, we stop the scaling process
                setIndexOfScalingBox(null);
                cornerOfScalingBox.current = null;
                topLeft.current = null;
                topRight.current = null;
                bottomLeft.current = null;
                bottomRight.current = null;
            }
        }
        // only allow drawing if there is an image set
        else if (currentImage) {
            isDrawing.current = true;

            originBoxX.current = x;
            originBoxY.current = translatedY;

            // create entry in the bounding box list
            setBoundingBoxes(prevBoxes => {
                const id = availableId.current;
                prevBoxes.push(
                    {
                        x: x, 
                        y: translatedY, 
                        width: 0, 
                        height: 0, 
                        id: id
                    }
                )
                return [...prevBoxes];
            })
        }
    }

    const stopDrawingBox = (() => {
        originBoxX.current = null;
        originBoxY.current = null;
        availableId.current++;
    })

    // either we are drawing a box (clicked before), checking if a box is hovered over, or move a box
    const onMouseMove = (({nativeEvent}) => {

        const {x, y} = nativeEvent;
        const translatedY = translateY(y);

        // moving a box
        if(indexOfMovingBox.current !== null) {
            setBoundingBoxes(prevBoxes => {
                const movingBox = prevBoxes[indexOfMovingBox.current]
                prevBoxes[indexOfMovingBox.current] = {
                    x: x - (movingBox.width / 2), 
                    y: translatedY - (movingBox.height / 2), 
                    width: movingBox.width, 
                    height: movingBox.height,
                    id: movingBox.id
                };
                return [...prevBoxes];
            })
        }
        // rescaling a box
        else if(indexOfScalingBox !== null) {

            // check if the user has clicked a corner already
            if(cornerOfScalingBox.current !== null) {
                const boxId = boundingBoxes[indexOfScalingBox].id;

                if (cornerOfScalingBox.current === "topLeft") {
                    // "anchor" during the scaling is bottom right
                    setBoundingBoxes(prevBoxes => {
                        prevBoxes[indexOfScalingBox] = {
                            x: bottomRight.current.x, 
                            y: bottomRight.current.y, 
                            width: x - bottomRight.current.x, 
                            height: translatedY - bottomRight.current.y,
                            id: boxId
                        }
                        return [...prevBoxes];
                    })
                }
                else if (cornerOfScalingBox.current === "topRight") {
                    // "anchor" during the scaling is bottom left
                    setBoundingBoxes(prevBoxes => {
                        prevBoxes[indexOfScalingBox] = {
                            x: bottomLeft.current.x, 
                            y: bottomLeft.current.y, 
                            width: x - bottomLeft.current.x, 
                            height: translatedY - bottomLeft.current.y,
                            id: boxId
                        }
                        return [...prevBoxes];
                    })
                }
                else if (cornerOfScalingBox.current === "bottomLeft") {
                    // "anchor" during the scaling is top right
                    setBoundingBoxes(prevBoxes => {
                        prevBoxes[indexOfScalingBox] = {
                            x: topRight.current.x, 
                            y: topRight.current.y, 
                            width: x - topRight.current.x, 
                            height: translatedY - topRight.current.y,
                            id: boxId
                        }
                        return [...prevBoxes];
                    })
                }
                else if (cornerOfScalingBox.current === "bottomRight") {
                    // "anchor" during the scaling is top left
                    setBoundingBoxes(prevBoxes => {
                        prevBoxes[indexOfScalingBox] = {
                            x: topLeft.current.x, 
                            y: topLeft.current.y, 
                            width: x - topLeft.current.x, 
                            height: translatedY - topLeft.current.y,
                            id: boxId
                        }
                        return [...prevBoxes];
                    })
                }
                else {
                    console.log("the chosen corner does not exist")
                }
            }

        }
        // when not moving a box or rescaling or drawing, check if the user is hovering over a box
        else if (!isDrawing.current) {

            for (const boundingBox of boundingBoxes) {
                // there can also be negative width and height from the starting x and y coordinates
                var minBoxX = 0;
                var maxBoxX = 0;
                if(boundingBox.width < 0) {
                    minBoxX = boundingBox.x + boundingBox.width;
                    maxBoxX = boundingBox.x;
                }
                else {
                    maxBoxX = boundingBox.x + boundingBox.width;
                    minBoxX = boundingBox.x;
                }

                var minBoxY = 0;
                var maxBoxY = 0;
                if(boundingBox.height < 0) {
                    minBoxY = boundingBox.y + boundingBox.height;
                    maxBoxY = boundingBox.y;
                }
                else {
                    minBoxY = boundingBox.y;
                    maxBoxY = boundingBox.y + boundingBox.height;
                }
                    
                if (x > minBoxX 
                    && x < maxBoxX
                    && translatedY > minBoxY
                    && translatedY < maxBoxY) {
                    // saving the id so in case the user places a right click, I know which box he wants
                    setHighlightedId(boundingBox.id);
                    // we break because if there is overlap, we just want one box to be highlighted
                    return;
                }
            }
            // if we arrive here, the mouse is not inside any of the boxes
            setHighlightedId(null);
        }

        // this is the case that the user is drawing
        else {
            setBoundingBoxes(prevBoxes => {
            const currentBox = prevBoxes.pop();
            const id = currentBox.id;
            if(id !== availableId.current) {
                throw Error(`not modifying the current box! box id is ${id} but current id is ${availableId.current}`);
            }
            prevBoxes.push( 
                {
                    x: originBoxX.current, 
                    y: originBoxY.current, 
                    width: x - originBoxX.current, 
                    height: translatedY - originBoxY.current,
                    id: id
                }
            );
            return [...prevBoxes];
            })
        }
    })


    const moveToSegmentation = async () => {

        // prepare the bounding boxes to be sent to the backend
        // TODO: generalize this in a separate file
        const boxesRelativeToOriginalImage = [];
        for (const box of boundingBoxes) {
            // coordinates are relative to the image, therefore adapting
            // to scaling and shifts necessary
            boxesRelativeToOriginalImage.push(
                {
                x: (box.x - centerShiftX.current) / currentScale.current, 
                y: (box.y - centerShiftY.current) / currentScale.current,
                width: box.width / currentScale.current,
                height: box.height / currentScale.current,
                id: box.id
                }
            );
        }

        // TODO: make front-end/frontend and back-end/backend consistent
        const boundingBoxesJson = {bounding_boxes: boxesRelativeToOriginalImage};

        // send final state of the boxes to the backend
        axios.put("http://localhost:8000/bounding-boxes", boundingBoxesJson).then(_ => {
                // ignoring the response, bc ending up here means status ok
                navigate(`/segmentation/${boundingBoxes.map(boundingBox => boundingBox.id)}`);
            }
        ).catch(error => {
            console.log(`error with code ${error.response.status} occurred while trying to send the final
            bounding boxes to the backend`);
            // TODO: show this in the web app?
        });
    }


    const [menuProps, toggleMenu] = useMenuState();
    const [anchorPoint, setAnchorPoint] = useState({ x: 0, y: 0 });

    const removeBox = () => {
        if(highlightedId === null) {
            return;
        }
        setBoundingBoxes(prevBoxes => {
            const newBoxes = [];
            for (const box of prevBoxes) {
                if(!(box.id === highlightedId)) {
                    console.log("adding box to the new boxes")
                    newBoxes.push(box);
                }
                else {
                    console.log("ignoring box");
                }
            }
            return newBoxes;
        })
    }

    const moveBox = () => {
        var index = 0;
        for (const box of boundingBoxes) {
            const {x, y, width, height, id} = box;
            if (id === highlightedId) {
                indexOfMovingBox.current = index;
            }
            else {
                index++;
            }
        }
    }

    const rescaleBox = () => {
        var index = 0;
        for (const box of boundingBoxes) {
            const {x, y, width, height, id} = box;
            if (id === highlightedId) {
                setIndexOfScalingBox(index);
                // since there is also negative height and width, several checks are necessary
                if(width < 0) {
                    if(height < 0) {
                        topLeft.current = {x: x + width, y: y + height};
                        topRight.current = {x: x, y: y + height};
                        bottomLeft.current = {x: x + width, y: y};
                        bottomRight.current = {x: x, y: y};
                    }
                    else {
                        topLeft.current = {x: x + width, y: y};
                        topRight.current = {x: x, y: y};
                        bottomLeft.current = {x: x + width, y: y + height};
                        bottomRight.current = {x: x, y: y + height};
                    }
                }
                else {
                    if(height < 0) {
                        topLeft.current = {x: x, y: y + height};
                        topRight.current = {x: x + width, y: y + height};
                        bottomLeft.current = {x: x, y: y};
                        bottomRight.current = {x: x + width, y: y};
                    }
                    else {
                        topLeft.current = {x: x, y: y};
                        topRight.current = {x: x + width, y: y};
                        bottomLeft.current = {x: x, y: y + height};
                        bottomRight.current = {x: x + width, y: y + height};
                    }
                }
            }
            else {
                index++;
            }
        }

    }

    const brightnessChanged = (_, newValue) => {
        setBrightness(newValue);
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
            </div>
            <div className="canvasContainer" onContextMenu={e => {
                        e.preventDefault();
                        setAnchorPoint({ x: e.clientX, y: e.clientY });
                        // only showing the menu when the user is hovering over a box
                        if (highlightedId !== null) {
                            toggleMenu(true);
                        }
                    }}>
                    <ControlledMenu {...menuProps} anchorPoint={anchorPoint}
                    direction="right" onClose={() => toggleMenu(false)}
                    >
                        <MenuItem onClick={removeBox}>Remove</MenuItem>
                        <MenuItem onClick={moveBox}>Move</MenuItem>
                        <MenuItem onClick={rescaleBox}>Rescale</MenuItem>
                    </ControlledMenu>
	        	    <canvas className="canvas1"
                        ref={canvasRef1}
	        	    />
                    <canvas className="canvas2"
                        onClick={onLeftClick}
                        onMouseMove={onMouseMove}
                        // TODO: figure this behavior out, there is a bug
                        onMouseLeave={stopDrawingBox}
                        ref={canvasRef2}
                    />
            </div>
            <button className="button_bounding" onClick={loadImage}>
	        	Load image
	        </button>
            <button className="button_bounding" onClick={moveToSegmentation}>
	        	Continue to segmentation
	        </button>
        </div>
	);
}