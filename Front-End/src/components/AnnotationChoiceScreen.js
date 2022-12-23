import './AnnotationChoiceScreen.css';
import axios from 'axios';

export default function AnnotationChoiceScreen() {

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
        axios.get(
            `http://localhost:8000/coco-annotations`       
        ).then(async response => {

            const descriptor = {
                writable: true,
                mode: "readwrite"
            }
            const permissionState = await handle.requestPermission(descriptor)
            // TODO: check the permissionState
            console.log(`permission state: ${permissionState}`);

            const writeableStream = await handle.createWritable();
            await writeableStream.write(response.data);
            await writeableStream.close();
        });
    }


    // TODO: navigate back when everything is saved and don't forget to reset all the file handles that might be saved in location!

    return (
        <div className="center">
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