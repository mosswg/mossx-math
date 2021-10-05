const bg_color = "#212529";
const text_color = "#6c757d";

var font_name;
const font_size = 30;


const selection_alpha = 0.35;

var max_height = 0;
var max_width = 0;

const cursor_blink_speed = 300;


class point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class line {
    constructor() {
        this.text = [];
        this.selection = new point(0, 0);
        this.selection.start = -1;   /// FIXME: This is a hack. 
        this.selection.end = -1;     ///        We really shouldn't be adding imaginary fields to a point object. But x and y don't make sense for this object
    }

    /**
     * @returns length of the line.
     */
    length() {
        return this.text.length;
    }

    /**
     * Deselects the entire line of text.
     */
    deselect_text() {
        this.selection.start = -1;
        this.selection.end = -1;
    }

    /**
     * @param {number} from - The start of the selection
     * @param {number} to - The end of the selection
     * 
     * At -1 Signifies the end of the array.
     */
    select_text(from, to) {
        if (from === -1) { from = this.text.length; }
        if (to === -1) { to = this.text.length; }
        this.selection.start = from;
        this.selection.end = to;
    }

    /**
     * Selects the entire line of text.
     */
    select_line() {
        this.selection.start = 0;
        this.selection.end = this.text.length-1;
    }

    /**
     * 
     * @returns {boolean} Whether any of the text is selected.
     */
    is_selected() {
        return this.selection.start !== -1 && this.selection.end !== -1;
    }

    /**
     * Deleted selected text from the line.
     */
    remove_selection() {
        for (var i = 0; i < Math.abs(this.selection.start - this.selection.end); i++) {
            this.text.splice(Math.min(this.selection.start, this.selection.end), 1); 
        }
        this.deselect_text();
    }
}


const letter_space = new point(0, 5);
const default_position = new point(15, 25);


var g_text_buffer = [new line()];
var g_cursor_position = new point(0, 0);
var g_cursor_visible = true;
var g_cursor_interval;
var g_cursor_size = new point(0, 0);
var g_letter_spacing;
var g_selection_start = new point(-1, -1);
var g_selection_end = new point(-1, -1);
var g_canvas;
var g_ctx;

function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

function set_cursor_position(x, y) {
    y = clamp(y, 0, g_text_buffer.length-1);
    x = clamp(x, 0, g_text_buffer[y].length());

    g_cursor_position.x = x;
    g_cursor_position.y = y;

    update_cursor();
}

function increment_cursor_position(x, y) {
    y = clamp(y, -g_cursor_position.y, g_text_buffer.length-1 - g_cursor_position.y);
    x = clamp(x, -g_cursor_position.x, g_text_buffer[g_cursor_position.y + y].length() - g_cursor_position.x);

    g_cursor_position.x += x;
    g_cursor_position.y += y;

    update_cursor();
}

function update_cursor() {
    clearInterval(g_cursor_interval);
    g_cursor_visible = true;
    g_cursor_interval = setInterval(draw_cursor, cursor_blink_speed);
    reload_buffer();
    draw_cursor();
}

function draw_cursor() {
    if (g_cursor_visible) {
        g_ctx.beginPath();
        g_ctx.rect(get_cursor_x_in_pixels() - (g_letter_spacing/2 + g_cursor_size.x), get_cursor_y_in_pixels() - g_cursor_size.y, g_cursor_size.x, g_cursor_size.y);
        g_ctx.fill();
    }
    else {
        g_ctx.clearRect(get_cursor_x_in_pixels() - (g_letter_spacing/2 + g_cursor_size.x), get_cursor_y_in_pixels() - g_cursor_size.y, g_cursor_size.x, g_cursor_size.y);
    }

    g_cursor_visible = !g_cursor_visible;
}

function select_row(row) {
    g_text_buffer[row].select_line();
}

function deselect_text() {
    for (var i = 0; i < g_text_buffer.length; i++) {
        g_text_buffer[i].deselect_text();
    }
    reload_buffer();
}

function set_text_selected(from, to) {
    if (from.y === to.y) {
        g_text_buffer[y].select_text(from.x, to.x);
    }
    else {
        g_text_buffer[from.y].select_text(from.x, -1);
        for (var i = from.y; i < to.y; i++) {
            g_text_buffer[i].select_text(0, -1);
        }
        g_text_buffer[to.y].select_text(0, to.x);
    }
}

function start_selection_at(point) {
    g_text_buffer[point.y].select_text(point.x, point.x);
}

function increment_selection_position(x, y) {
    if (!g_text_buffer[g_cursor_position.y + y].is_selected()) {
        g_text_buffer[g_cursor_position.y + y].select_text(g_cursor_position.x, g_cursor_position.x);
    }
    if (y !== 0) { 
        g_text_buffer[g_cursor_position.y + y].selection.start = g_text_buffer[g_cursor_position.y].selection.start;
        g_text_buffer[g_cursor_position.y + y].selection.end = g_text_buffer[g_cursor_position.y].selection.end;
    }
    g_text_buffer[g_cursor_position.y + y].selection.end+=x;
}

function something_is_selected() {
    for (var i = 0; i < g_text_buffer.length; i++) {
        if (g_text_buffer[i].is_selected()) {
            return true;
        }
    }
    return false;
}

function delete_selected() {
    for (var i = 0; i < g_text_buffer.length; i++) {
        g_text_buffer[i].remove_selection();
    }
}

function draw_selection(start_point, end_point, row = g_cursor_position.y) {
    g_ctx.globalAlpha = selection_alpha;
    g_ctx.beginPath();
    g_ctx.rect(cursor_x_to_pixels(start_point)-g_letter_spacing/2, cursor_y_to_pixels(row) - max_height, g_letter_spacing * Math.abs(start_point - end_point), g_cursor_size.y);
    g_ctx.fill();
    g_ctx.globalAlpha = 1;
}

function cursor_x_to_pixels(x) {
    return x * g_letter_spacing + default_position.x;
}

function pixel_x_to_cursor(x) {
    return (x - default_position.x) / g_letter_spacing;
}

function cursor_y_to_pixels(y) {
    return y * g_cursor_size.y + default_position.y;
}

function pixel_y_to_cursor(y) {
    return (y - default_position.y) / g_cursor_size.y;
}

function get_cursor_x_in_pixels() {
    return cursor_x_to_pixels(g_cursor_position.x);
}
function get_cursor_y_in_pixels() {
    return cursor_y_to_pixels(g_cursor_position.y);
}

function insert_letter_at_cursor(key) {
    g_text_buffer[g_cursor_position.y].text.splice(g_cursor_position.x, 0, key);
    increment_cursor_position(1, 0);
}

function position_of_first_selected_letter() {
    if (something_is_selected()) {
        return g_selection_start;
    }
    return undefined;
}

function reload_buffer() {
    const pushed_cursor_position_x = g_cursor_position.x;
    const pushed_cursor_position_y = g_cursor_position.y;
    g_cursor_position.x = 0, g_cursor_position.y = 0;

    // Write key presses to the canvas.
    g_ctx.clearRect(0, 0, window.innerWidth*2, window.innerHeight*2); // Clear the canvas
    for (var i = 0; i < g_text_buffer.length; i++) {
        for (var j = 0; j < g_text_buffer[i].length(); j++) {
            write_key(g_text_buffer[i].text[j], false); // Simulate the key presses of the buffer without appending to the buffer
        }
        g_cursor_position.y++;
        g_cursor_position.x = 0;
    }

    g_cursor_position.x = pushed_cursor_position_x;
    g_cursor_position.y = pushed_cursor_position_y;

    // Highlight Selected Text
    if (something_is_selected()) {
        var start;
        var end;
        
        for (var i = 0; i < g_text_buffer.length; i++) { /// TODO: Optimize this
            if (g_text_buffer[i].is_selected) {
                start = clamp(Math.min(g_text_buffer[i].selection.start, g_text_buffer[i].selection.end), 0, g_text_buffer[i].length());
                end = clamp(Math.max(g_text_buffer[i].selection.start, g_text_buffer[i].selection.end), 0, g_text_buffer[i].length());
                draw_selection(start, end, i);
            }
        }

    }
}

function calculate_max_letter_size() { 
    for (var i = 'a'; i <= 'z'; i = String.fromCharCode(i.charCodeAt(0) + 1)) {
        letter_size = g_ctx.measureText(i);
        height = letter_size.actualBoundingBoxAscent - letter_size.actualBoundingBoxDescent;
        if (height > max_height) {
            max_height = height;
        }
    }
}

function key_pressed_listener(e) {
    key_pressed(e, true);
}

function mouse_click_listener(e) {
    deselect_text();
    rect = g_canvas.getBoundingClientRect()
    var mouse_x = e.clientX - rect.left + g_letter_spacing/2; // We're offseting by half the letter width so that we round based on the middle of the letter and not the end 
    var mouse_y = e.clientY - rect.top;

    set_cursor_position(Math.round(pixel_x_to_cursor(mouse_x)), Math.round(pixel_y_to_cursor(mouse_y)));
}



function key_pressed(key, append_to_buffer) {
    if (key.ctrlKey) {
        switch(key.key) {
            case 'a':
                g_selection_start.x = 0;
                g_selection_start.y = 0;
                g_selection_end.x = g_text_buffer[g_text_buffer.length-1].length()-1; /// FIXME: We should find the max row width instead 
                g_selection_end.y = g_text_buffer.length-1;
                reload_buffer();
                break;
        }
        return;
    }
    


    if (key.key.length != 1 && key.key.startsWith("F")) { // Ignore function keys
        return;
    }
    if (key.key.startsWith("Arrow")) {
        if (!key.shiftKey) {
            deselect_text();
        }
        if (key.key == 'ArrowRight') {
            if (key.shiftKey) {
                if (!something_is_selected()) {
                    g_text_buffer[g_cursor_position.y].selection.start = g_cursor_position.x;
                    g_text_buffer[g_cursor_position.y].selection.end = g_cursor_position.x;
                }
                increment_selection_position(1, 0);
                increment_cursor_position(1, 0);
            }
            else if (g_cursor_position.x === g_text_buffer[g_cursor_position.y].length() && g_text_buffer.length !== 1 && g_cursor_position.y !== g_text_buffer.length-1) {
                g_cursor_position.x = 0; 
                increment_cursor_position(0, 1);
            }
            else {
                increment_cursor_position(1, 0);
            }
        }
        else if (key.key == 'ArrowLeft') {
            if (key.shiftKey) {
                if (!something_is_selected()) {
                    g_text_buffer[g_cursor_position.y].selection.start = g_cursor_position.x;
                    g_text_buffer[g_cursor_position.y].selection.end = g_cursor_position.x;
                }
                increment_selection_position(-1, 0);
                increment_cursor_position(-1, 0);
            }
            else if (g_cursor_position.x === 0 && g_cursor_position.y !== 0) {
                g_cursor_position.x = g_text_buffer[g_cursor_position.y-1].length(); 
                increment_cursor_position(0, -1);
            }
            else {
                increment_cursor_position(-1, 0);
            }
        }
        else if (key.key == 'ArrowUp') {
            if (key.shiftKey) {
                if (g_cursor_position.y != 0) {
                    if (!something_is_selected()) {
                        g_text_buffer[g_cursor_position.y-1].selection.start = g_cursor_position.x;
                        g_text_buffer[g_cursor_position.y-1].selection.end = g_cursor_position.x;
                    }
                    increment_selection_position(0, -1);
                    increment_cursor_position(0, -1);
                }
            }
            else if (g_cursor_position.y === 0) {
                g_cursor_position.x = 0;
                update_cursor();
            }
            else {
                increment_cursor_position(0, -1);
            }
        }
        else if (key.key == 'ArrowDown') {
            if (key.shiftKey) {
                if (g_cursor_position.y != g_text_buffer.length - 1) {
                    if (!something_is_selected()) {
                        start_selection_at(g_cursor_position);
                    }
                    increment_selection_position(0, 1);
                    increment_cursor_position(0, 1);
                }
            }
            else if (g_cursor_position.y === g_text_buffer.length-1) {
                g_cursor_position.x = g_text_buffer[g_cursor_position.y].length(); 
                update_cursor();
            }
            else {
                increment_cursor_position(0, 1);
            }
        }
    }
    else {
        write_key(key.key, append_to_buffer);
    }
}

function write_key(key, append_to_buffer) {
    switch (key) {
        case "Enter":
            if (append_to_buffer) {
                g_text_buffer.splice(g_cursor_position.y + 1, 0, new line());
                var next_line_length = g_text_buffer[g_cursor_position.y + 1].length();
                if (g_cursor_position.x !== g_text_buffer[g_cursor_position.y].length()-1) {   // If the cursor is not at the end of the buffer move everything after 
                                                                        // the cursor to the new line.
                    var after_newline = g_text_buffer[g_cursor_position.y].text.slice(g_cursor_position.x);
                    g_text_buffer[g_cursor_position.y + 1].text.push.apply(g_text_buffer[g_cursor_position.y + 1].text, after_newline);
                    g_text_buffer[g_cursor_position.y].text.splice(g_cursor_position.x, after_newline.length);
                }
                set_cursor_position(next_line_length, g_cursor_position.y + 1);
            }
            else {
                g_cursor_position.y++;
                g_cursor_position.x = 0;
            }
            return;
        case "Backspace":
            if (something_is_selected()) {
                delete_selected();
            }
            else {
                if (g_cursor_position.x === 0 && g_cursor_position.y === 0) { return; } // Ignore a backspace at the beginning of the screen
                if (g_cursor_position.x === 0) {
                    previous_line_length = g_text_buffer[g_cursor_position.y - 1].length();
                    g_text_buffer[g_cursor_position.y - 1].text.push.apply(g_text_buffer[g_cursor_position.y-1].text, g_text_buffer[g_cursor_position.y].text);
                    g_text_buffer.splice(g_cursor_position.y, 1);
                    set_cursor_position(previous_line_length, g_cursor_position.y - 1);
                }
                else {
                    g_text_buffer[g_cursor_position.y].text.splice(g_cursor_position.x-1, 1);
                    increment_cursor_position(-1, 0);
                }
            }
            reload_buffer();
            return;
        case "Delete":
            if (something_is_selected()) {
                delete_selected();
            }
            else {                
                if (g_cursor_position.x === g_text_buffer[g_cursor_position.y].length()) {
                    next_line_length = g_text_buffer[g_cursor_position.y + 1].length();
                    g_text_buffer[g_cursor_position.y].text.push.apply(g_text_buffer[g_cursor_position.y].text, g_text_buffer[g_cursor_position.y + 1].text);
                    g_text_buffer.splice(g_cursor_position.y+1, 1);
                    update_cursor();
            }
            else {
                g_text_buffer[g_cursor_position.y].text.splice(g_cursor_position.x, 1);
                update_cursor();
            }
            }
            reload_buffer();
            return;
        case "Tab":
        case "CapsLock":
            return;
        default:
            g_ctx.fillText(key, get_cursor_x_in_pixels(), get_cursor_y_in_pixels());
            if (append_to_buffer) {
                if (something_is_selected()) {
                    var selection_position = position_of_first_selected_letter();
                    set_cursor_position(selection_position.x, selection_position.y);
                    delete_selected();
                }
                insert_letter_at_cursor(key);
            }
            else {
                g_cursor_position.x++;
            }
            return;
    }
}

function load() {
    document.querySelector("#editor").width = window.innerWidth - (window.innerWidth/10);   // Set the width of the canvas to the width of the window - 10%
    document.querySelector("#editor").height = window.innerHeight-(window.innerHeight/10);  // Same with the height
    g_canvas = document.getElementById("editor");
    g_ctx = g_canvas.getContext('2d');

    window.addEventListener('keydown', key_pressed_listener, false);
    window.addEventListener('mousedown', mouse_click_listener);

    font_first_space = g_ctx.font.indexOf(' ');
    font_name = g_ctx.font.substring(font_first_space + 1);

    g_ctx.font = font_size + "px " + font_name;
    g_ctx.fillStyle = text_color;
    g_ctx.imageSmoothingEnabled = false;
    g_ctx.textAlign = "center";

    calculate_max_letter_size();

    g_letter_spacing = g_ctx.measureText('w').width;
    g_cursor_size.y = max_height;
    g_cursor_size.x = 2;

    g_cursor_interval = setInterval(draw_cursor, cursor_blink_speed);
}