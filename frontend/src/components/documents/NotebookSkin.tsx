export function NotebookSkin() {
    return (
        <div className="notebook-skin" aria-hidden="true">
            <div className="notebook-cover-panel notebook-cover-panel-left">
                <span className="notebook-cover-gloss" />
                <span className="notebook-cover-stitch" />
            </div>

            <div className="notebook-center-hinge">
                <span className="notebook-hinge-highlight" />
            </div>

            <div className="notebook-cover-panel notebook-cover-panel-right">
                <span className="notebook-cover-gloss" />
                <span className="notebook-cover-stitch" />
            </div>
        </div>
    );
}