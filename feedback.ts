/*
 * Player feedback which is initilized from the UI by link. Player provides feedback-category and short description, and optional a screenshot from drawn by a rectangle.
 */
class mgc_PlayerFeedback {
    mgp_isSelecting: boolean;
    mgp_isInitilized: boolean;
    mgp_start: any;
    mgp_end: any;
    mgp_feedback_message: string;
    mgp_feedback_imagepngdata: string;
    mgp_feedback_type: string;
    constructor() {
        // Things we need to keep track of
        this.mgp_start = {};
        this.mgp_end = {};
        this.mgp_isSelecting = false;
        this.mgp_isInitilized = false;
    }

    mgp_init(callback: Function) {
        if (this.mgp_isInitilized)
            return;
        if (typeof html2canvas == "undefined")
            $.getScript("/lib/html2canvas.min.js").done((script, textStatus) => { callback(); });
        else
            callback();
        this.mgp_isInitilized = true;
    }
    capture() {
        if (!this.mgp_isInitilized) {
            this.mgp_init(() => { this.capture(); });
            return;
        }

        this.mgp_start = {};
        this.mgp_end = {};
        this.mgp_feedback_message = $("#mg_feedback_message").val() as string;
        this.mgp_feedback_type = $("#mg_feedback_type").val() as string;
        Core.World.map.mgp_modalpanel.close();
        Core.World.player.mgp_playerlog.mgm_addnotification("Click and move mousepointer", "Capture a screenshot region");
        this.mgm_bind();
    }

    submit() {
        this.mgp_feedback_message = $("#mg_feedback_message").val() as string;
        this.mgp_feedback_type = $("#mg_feedback_type").val() as string;
        if (this.mgp_feedback_message == null || this.mgp_feedback_message.length < 1)
            return;

        if (this.mgp_feedback_imagepngdata == null)
            this.mgp_feedback_imagepngdata = "";
        Core.mgp_ServerCom.mgm_messageCallback(null, mge_SocketMessageType.PlayerMenu, { action: "feedback_submit", feedback_type: this.mgp_feedback_type, feedback_message: this.mgp_feedback_message, feedback_imagedata: this.mgp_feedback_imagepngdata }, (caller: any, result) => {
            if (Core.World.map.mgp_modalpanel != null)
                Core.World.map.mgp_modalpanel.close();
            this.mgp_feedback_imagepngdata = null;
            this.mgp_feedback_message = null;
            $("#mg_feedback_message").val("");
            Core.World.player.mgp_playerlog.mgm_addnotification("Thank you! Your message has successfully been submitted.", "Feedback");
        });
    }

    screenshot(element, options) {
        // our cropping context

        // save the passed width and height
        const finalWidth = options.width || window.innerWidth;
        const finalHeight = options.height || window.innerHeight;

        if (options.x)
            options.width = finalWidth + options.x;
        if (options.y)
            options.height = finalHeight + options.y;

        /*This is important to make it crop correctly*/
        options.scrollX = options.x;
        options.scrollY = options.y;
        options.windowWidth = window.outerWidth * 2;
        options.windowHeight = window.outerHeight * 2;

        return html2canvas(element, options).then(c => {
            const cropcanvas = document.createElement("canvas").getContext("2d");
            cropcanvas.canvas.width = finalWidth;
            cropcanvas.canvas.height = finalHeight;
            cropcanvas.drawImage(c, options.x, options.y, options.width, options.height, 0, 0, options.width, options.height);
            // return our canvas
            return cropcanvas.canvas;
        });
    }

    editscrn() {
        const canvas = document.getElementById("scrnshtcanvas") as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");

        //Variables
        const canvasx = $(canvas).offset().left;
        const canvasy = $(canvas).offset().top;
        let last_mousex = 0;
        let last_mousey = 0;
        let mousex = 0;
        let mousey = 0;
        let mousedown = false;

        //Mousedown
        $(canvas).on("mousedown", e => {
            last_mousex = mousex = e.clientX - canvasx;
            last_mousey = mousey = e.clientY - canvasy;
            mousedown = true;
        });

        //Mouseup
        $(canvas).on("mouseup", e => {
            mousedown = false;
        });

        //Mousemove
        $(canvas).on("mousemove", e => {
            mousex = e.clientX - canvasx;
            mousey = e.clientY - canvasy;
            if (mousedown) {
                ctx.beginPath();

                ctx.globalCompositeOperation = "source-over";
                ctx.strokeStyle = "red";
                ctx.lineWidth = 3;

                ctx.moveTo(last_mousex, last_mousey);
                ctx.lineTo(mousex, mousey);
                ctx.lineJoin = ctx.lineCap = "round";
                ctx.stroke();
            }
            last_mousex = mousex;
            last_mousey = mousey;
            //Output
        });
    }

    savescrn() {
        const canvas = document.getElementById("scrnshtcanvas") as HTMLCanvasElement;

        const FileUrl = canvas.toDataURL("image/png");

        const a = document.createElement("a");
        a.href = FileUrl.replace("image/png", "image/octet-stream");
        a.download = "SCREENSHOT_.png";
        a.click();

        //	$("#screenshtdialog").dialog('close');
    }

    mgm_bind() {
        $(window)
            // Listen for selection
            .on("mousedown", e => {
                // Update our state
                this.mgp_isSelecting = true;
                $("#mg_feedback_selection").removeClass("complete");
                this.mgp_start.x = e.pageX;
                this.mgp_start.y = e.pageY;
                // Add selection to screen
                $("#mg_feedback_selection").css({ left: this.mgp_start.x, top: this.mgp_start.y });
            })
            // Listen for movement
            .on("mousemove", e => {
                // Ignore if we're not selecing
                if (!this.mgp_isSelecting)
                    return;

                // Update our state
                this.mgp_end.x = e.pageX;
                this.mgp_end.y = e.pageY;

                // Move & resize selection to reflect mouse position
                $("#mg_feedback_selection").css({
                    left: this.mgp_start.x < this.mgp_end.x ? this.mgp_start.x : this.mgp_end.x,
                    top: this.mgp_start.y < this.mgp_end.y ? this.mgp_start.y : this.mgp_end.y,
                    width: Math.abs(this.mgp_start.x - this.mgp_end.x),
                    height: Math.abs(this.mgp_start.y - this.mgp_end.y)
                });
            })
            // listen for end
            .on("mouseup", $event => {
                // Update our state
                this.mgp_isSelecting = false;
                $("#mg_feedback_selection").addClass("complete");
                $(window).unbind();
                Core.World.player.feedback_dialog();

                if (isNaN(this.mgp_start.y) || isNaN(this.mgp_start.x)) {
                    Core.World.player.mgp_playerlog.mgm_addchanneltext("Invalid options for screenshot.", mge_PlayerChannel.SystemError);
                    return;
                }
                this.screenshot(document.body, {
                    x: this.mgp_start.x < this.mgp_end.x ? this.mgp_start.x : this.mgp_end.x,
                    y: this.mgp_start.y < this.mgp_end.y ? this.mgp_start.y : this.mgp_end.y,
                    width: Math.abs(this.mgp_start.x - this.mgp_end.x),
                    height: Math.abs(this.mgp_start.y - this.mgp_end.y),
                    useCORS: true,
                    foreignObjectRendering: true,
                }).then(c => {
                    if (c == null)
                        return;
                    $("#mg_feedback_message").val(this.mgp_feedback_message);
                    $("#mg_feedback_type").val(this.mgp_feedback_type);
                    this.mgp_feedback_imagepngdata = c.toDataURL("image/jpeg", 0.75);

                    if (this.mgp_feedback_imagepngdata.length > 80000) {
                        Core.World.player.mgp_playerlog.mgm_addchanneltext(`Image is too large ${this.mgp_feedback_imagepngdata.length} (max is 80k) select a smaller region.`, mge_PlayerChannel.SystemError);
                        this.mgp_feedback_imagepngdata = null;
                    }
                    else {
                        const imgobj = $("#mg_feedbackimage")[0] as HTMLImageElement;
                        imgobj.src = this.mgp_feedback_imagepngdata;
                    }
                });
            });
    }
}