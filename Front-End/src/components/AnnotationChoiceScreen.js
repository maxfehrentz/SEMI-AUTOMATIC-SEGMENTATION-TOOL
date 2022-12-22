import './AnnotationChoiceScreen.css';

export default function AnnotationChoiceScreen() {

    const clickedCOCO = async () => {
        console.log("COCO was chosen");

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

        // TODO: send relevant infos to backend and let it deal with conversion etc
    }

    const clickedPascal = () => {
        console.log("Pascal was chosen");
        // TODO: let user choose a folder where to save the annotations
    }

    return (
        <div className="center">
            <header>
                <h1>Annotation formats</h1>
            </header>
            <p>Choose from <em>COCO</em> and <em>PascalVOC</em> to export your annotations!</p>
            <button className="button_choice" onClick={clickedCOCO}>
                COCO
            </button>
            <button className="button_choice" onClick={clickedPascal}>
                PascalVOC
            </button>
        </div>
    )
}