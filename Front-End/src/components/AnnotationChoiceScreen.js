import './AnnotationChoiceScreen.css';
import './SharedStyles.css';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';


export default function AnnotationChoiceScreen() {

    // state to control loading annimations
    const [loading, setLoading] = useState(false);

    // navigation
    const navigate = useNavigate();
    // this variable contains a state that is persisted over screen navigations
    const location = useLocation();

    const clickedCOCO = async () => {

        // for more information see https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker
        // note: as of December 2022, this is only supported by chromium based web browsers!
        const handle = await window.showSaveFilePicker({
            suggestedName: 'annotations.json',
            types: [{
              description: 'JSON',
              accept: {
                'application/json': ['.json'],
              },
            }],
          });

        /* send relevant infos to backend; will be GET request because writeback
        of the json content has to happen here since the full path of the chosen location is not revealed in
        the browser, only the handle and the handle cannot be passed to the backend */ 
        setLoading(true);
        axios.get(
            `https://${window.location.hostname}:8000/coco-annotations`
        ).then(async response => {

            const descriptor = {
                writable: true,
                mode: "readwrite"
            }
            const permissionState = await handle.requestPermission(descriptor)
            console.log(`permission state: ${permissionState}`);

            const writeableStream = await handle.createWritable();
            await writeableStream.write(response.data);
            await writeableStream.close();
            setLoading(false);
            
            /* 
            clean up all states/locations etc in the navigation and also let backend know to clean up,
            then navigate back to the start
            */
            location.state = null;
            axios.post(`https://${window.location.hostname}:8000/annotation-process-finished`).then( _ => {
                navigate("/");
            });
        });
    }



    return (
        <div className="center">
            {/* taken from https://stackabuse.com/how-to-create-a-loading-animation-in-react-from-scratch/ */}
            {loading &&
            <div className="loader-container">
                <div className="spinner"></div>
                <h1>
                    The .json file with COCO-formated annotations is being created.
                    <br/>
                    The contents of that file are visualized, point your browser to http://&lt;current_ip&gt;:5151
                </h1>
            </div>   
            } 
            <header>
                <h1>Annotation formats</h1>
            </header>
            <p>Choose from <em>COCO</em> and more to come to export your annotations!</p>
            <button className="button_choice" onClick={clickedCOCO}>
                COCO
            </button>
        </div>
    )
}