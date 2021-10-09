const bg_color = "#212529";
const text_color = "#6c757d";

var font_name = "Iosevka";
const font_size = 30;


const selection_alpha = 0.35;

var max_height = 0;

const cursor_blink_speed = 300;

const states = {
    text: write_text,
    navigation: navigate,
    create_symbol: identify_math_symbol,
    edit_symbol: edit_math_symbol,
}

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
        this.selection.end = -1;     ///        We really shouldn't be adding imaginary fields to a point object. 
                                     ///        But x and y don't make sense for this object.
    }

    /**
     * @returns length of the line in elements.
     */
    length() {
        return this.text.length;
    }


    /**
     * 
     * @returns length of the line in drawn characters.
     */
    char_length() {
        var length = 0;
        for (var i = 0; i < this.text.length; i++) {
            if (this.text[i].draw !== undefined) {
                length += this.text[i].displayed_length();
                i+= this.text[i].args.length;
            }
            else {
                length += this.text[i].length;
            }
        }
        return length;
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
        this.selection.end = this.text.length;
    }

    /**
     * If index is undefined it will return if anything in the entire line is selected.
     * 
     * @param {number} index The index to be check. Can be undefined.
     * @returns {boolean} Whether any of the text is selected.
     */
    is_selected(index) {
        if (index === undefined) {
            return this.selection.start !== -1 && this.selection.end !== -1;
        }

        if (index >= this.char_length()) return false;

        var start = Math.min(this.selection.start, this.selection.end);
        var end = Math.max(this.selection.start, this.selection.end);

        return index >= start && index <= end;
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


    remove_char_at(idx) {
        var curr = 0;
        for (var i = 0; i < this.char_length(); curr++) {
            if (idx <= line.get_modified_length(this.text[curr]) + i) {
                if (this.text[curr].length !== 1 && !symbol.is_valid(this.text[curr])) {
                    this.text[curr] = this.text[curr].substring(0, idx - curr) + this.text[i].substring(idx - curr + 1);
                }
                else {
                    this.text.splice(curr, 1);
                }
                break;
            }
            else {
                i += line.get_modified_length(this.text[curr]);
            }
        }
    }

    /**
     * 
     * @param {number} column The column of the value to be checked 
     * @returns if the element at the given value is part of a math symbol
     */
    is_symbol(column) {
        if (column > this.text.length-1) return false;
        var curr = 0;
        for (var i = 0; i < this.char_length(); curr++) {
            if (column <= line.get_modified_length(this.text[curr]) + i) {
                return this.text[i].draw !== undefined;
            }
            else {
                i += line.get_modified_length(this.text[curr]);
            }
        }
        
    }

    get_modified_length(index) {
        if (symbol.is_valid(this.text[index])) {
            return 1;
        }
        
        if (text.startsWith("{")) {
            if (this.text[index-1].startsWith("{")) {
                return 0;
            }
            return this.text[index].length - 2;
        }
        
        return this.text[index].length;
    }

    /**
     * @param {String} text The text whose length will be gotten.
     * @returns {Number} the length of the text as it is displayed.
     */
    static get_modified_length(text) {
        if (symbol.is_valid(text)) {
            return 1;
        }
        
        if (text.startsWith("{")) {
            return text.length - 2;
        }
        
        return text.length;
    }
}

const default_position = new point(font_size, font_size);

var g_text_buffer = [new line()];
var g_tmp_buffer = "";
var g_current_symbol = "";
var g_current_symbol_position = new point(-1, -1);
var g_cursor_position = new point(0, 0);
var g_cursor_visible = true;
var g_cursor_interval;
var g_cursor_scale = new point(1, 1);
var g_cursor_size = new point(0, 0);
var g_letter_spacing;
var g_state = states.text;
var g_canvas;
var g_ctx;

function finish_math_symbol(id) {
    g_text_buffer[g_current_symbol_position.y].text.splice(g_current_symbol_position.x, 0, symbol.create_symbol(id));
    g_cursor_position.x -= id.length-1;
    g_state = states.text;
    id = "";
    reload_buffer();
}

function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

function set_cursor_position(x, y) {
    y = clamp(y, 0, g_text_buffer.length-1);
    x = clamp(x, 0, g_text_buffer[y].char_length());

    g_cursor_position.x = x;
    g_cursor_position.y = y;

    update_cursor();
}

function decrement_cursor_position(x, y) {
    y = clamp(y, -g_cursor_position.y, g_text_buffer.length-1 - g_cursor_position.y);
    x = clamp(x, -g_cursor_position.x, g_text_buffer[g_cursor_position.y + y].char_length() - g_cursor_position.x);

    g_cursor_position.x -= x;
    g_cursor_position.y -= y;

    update_cursor();
}

function increment_cursor_position(x, y) {
    y = clamp(y, -g_cursor_position.y, g_text_buffer.length-1 - g_cursor_position.y);
    x = clamp(x, -g_cursor_position.x, g_text_buffer[g_cursor_position.y + y].char_length() - g_cursor_position.x);

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
        g_ctx.rect(get_cursor_x_in_pixels() - (g_letter_spacing/2 + g_cursor_size.x), get_cursor_y_in_pixels() - g_cursor_size.y, g_cursor_size.x* g_cursor_scale.x, g_cursor_size.y* g_cursor_scale.y);
        g_ctx.fill();
    }
    else {
        g_ctx.clearRect(get_cursor_x_in_pixels() - (g_letter_spacing/2 + g_cursor_size.x), get_cursor_y_in_pixels() - g_cursor_size.y, g_cursor_size.x* g_cursor_scale.x, g_cursor_size.y * g_cursor_scale.y);
    }

    g_cursor_visible = !g_cursor_visible;
}

function draw_highlight(from, to) {

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
        if (g_text_buffer[i].is_selected()) {
            g_cursor_position.x = Math.min(g_text_buffer[i].selection.start, g_text_buffer[i].selection.end);
            g_cursor_position.y = i;
            g_text_buffer[i].remove_selection();
        }
    }
    update_cursor();
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

/**
 * Scales the scale of the cursor and text. \
 * 1 is the default scale of everything.
 * 
 * @param {number} x 
 * @param {number} y 
 */
function scale_cursor(x, y) {
    g_cursor_scale.x *= x;
    g_cursor_scale.y *= y;
    g_ctx.font = (font_size*Math.min(g_cursor_scale.x, g_cursor_scale.y)) + "px " + font_name;
}

/**
 * Unscales the scale of the cursor and text. \
 * 1 is the default scale of everything.
 * 
 * @param {number} x 
 * @param {number} y 
 */
 function unscale_cursor(x, y) {
    g_cursor_scale.x /= x;
    g_cursor_scale.y /= y;
    g_ctx.font = (font_size*Math.min(g_cursor_scale.x, g_cursor_scale.y)) + "px " + font_name;
}


/**
 * Sets the scale of the cursor and text. \
 * 1 is the default scale of everything.
 * 
 * @param {number} x 
 * @param {number} y 
 */
 function set_cursor_scale(x, y) {
    g_cursor_scale.x = x;
    g_cursor_scale.y = y;
    g_ctx.font = (font_size*Math.min(x, y)) + "px " + font_name;
}


/**
 * Draws the contents of g_text_buffer and the selected area to the g_ctx canvas.
 * 
 * TODO: Optimize for reloading single lines instead of the entire buffer.
 */
function reload_buffer() {
    const pushed_cursor_position_x = g_cursor_position.x;
    const pushed_cursor_position_y = g_cursor_position.y;
    const pushed_cursor_scale_x = g_cursor_scale.x;
    const pushed_cursor_scale_y = g_cursor_scale.y;
    g_cursor_position.x = 0, g_cursor_position.y = 0, set_cursor_scale(1, 1);

    // Write text to the canvas.
    g_ctx.clearRect(0, 0, window.innerWidth*2, window.innerHeight*2); // Clear the canvas
    for (var i = 0; i < g_text_buffer.length; i++) {
        for (var j = 0; j < g_text_buffer[i].length(); j++) {
            write_text(g_text_buffer[i].text[j], false); // Simulate the key presses of the buffer without appending to the buffer
        }
        g_cursor_position.y++;
        g_cursor_position.x = 0;
    }

    g_cursor_position.x = pushed_cursor_position_x;
    g_cursor_position.y = pushed_cursor_position_y;
    set_cursor_scale(pushed_cursor_scale_x, pushed_cursor_scale_y);

    // Draw Text  Selection
    if (something_is_selected()) {
        var start;
        var end;
        
        for (var i = 0; i < g_text_buffer.length; i++) {
            if (g_text_buffer[i].is_selected) {
                start = clamp(Math.min(g_text_buffer[i].selection.start, g_text_buffer[i].selection.end), 0, g_text_buffer[i].char_length());
                end = clamp(Math.max(g_text_buffer[i].selection.start, g_text_buffer[i].selection.end), 0, g_text_buffer[i].char_length());
                draw_selection(start, end, i);
            }
        }

    }
}

function calculate_max_letter_size() { 
    for (var i = 'a'; i <= 'z'; i = String.fromCharCode(i.charCodeAt(0) + 1)) {
        var letter_size = g_ctx.measureText(i);
        var height = letter_size.actualBoundingBoxAscent - letter_size.actualBoundingBoxDescent;
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
    var rect = g_canvas.getBoundingClientRect()
    var mouse_x = e.clientX - rect.left + g_letter_spacing/2; // We're offseting by half the letter width so that we round based on the middle of the letter and not the end 
    var mouse_y = e.clientY - rect.top;

    set_cursor_position(Math.round(pixel_x_to_cursor(mouse_x)), Math.round(pixel_y_to_cursor(mouse_y)));
}


function control_key_pressed(key) {
    switch(key.key) {
        case 'a':
            for (var i = 0; i < g_text_buffer.length; i++) {
                g_text_buffer[i].select_line();
            }
            reload_buffer();
            break;
        
    }
}

function is_text_key(key) {
    if (key.ctrlKey || key.altKey) {
        return false;
    }

    const ONE_KEY_CODE = 48;
    const Z_CHAR_CODE = 90;
    const SEMI_COLON_CHAR_CODE = 186;
    const QUOTE_CHAR_CODE = 222;

    return (key.keyCode >= ONE_KEY_CODE && key.keyCode < Z_CHAR_CODE) || (key.keyCode >= SEMI_COLON_CHAR_CODE && key.keyCode <= QUOTE_CHAR_CODE);
}

function identify_math_symbol(key) {
    if (key !== undefined) {
        switch (key.key) {
            case "/":
                finish_math_symbol("\\frac");
                return;
            case "_":
                finish_math_symbol("_");
                return;
            case "\\":
                return;
            case "Backspace":
                g_tmp_buffer = g_tmp_buffer.substring(0, g_tmp_buffer.length-1); // Remove last element
                reload_buffer();
                return;
            default:
                g_tmp_buffer = g_tmp_buffer.concat(key.key);
                if (symbol.is_valid("\\" + g_tmp_buffer)) {
                    finish_math_symbol(g_tmp_buffer);
                }
                else if (key.key === " ") { // If it's not a supported symbol write as plain text
                    for (var i = 0; i < g_tmp_buffer.length; i++) {
                        g_text_buffer[g_cursor_position.y].text.splice(g_cursor_position.x - g_tmp_buffer.length + i, 0, g_tmp_buffer[i]); 
                    }
                    g_tmp_buffer = "";
                }
        }
    }
    // Draw the keys without storing them.
    g_cursor_position.x = g_current_symbol_position.x;
    reload_buffer();
    for (var i = 0; i < g_tmp_buffer.length; i++) {
        write_text(g_tmp_buffer.charAt(i), false);
    }
}

function edit_math_symbol(key) {

}

function navigate(key) {
    if (key.key.startsWith("Arrow")) {
        arrow_key_pressed(key);
    }
    else if (key.ctrlKey) {
        control_key_pressed(key);
    }
    else {
        switch (key.key) {
            case "Enter":
                g_text_buffer.splice(g_cursor_position.y + 1, 0, new line());
                var next_line_length = g_text_buffer[g_cursor_position.y + 1].length();
                if (g_cursor_position.x !== g_text_buffer[g_cursor_position.y].length()-1) {   // If the cursor is not at the end of the buffer move everything after 
                                                                        // the cursor to the new line.
                    var after_newline = g_text_buffer[g_cursor_position.y].text.slice(g_cursor_position.x);
                    g_text_buffer[g_cursor_position.y + 1].text.push.apply(g_text_buffer[g_cursor_position.y + 1].text, after_newline);
                    g_text_buffer[g_cursor_position.y].text.splice(g_cursor_position.x, after_newline.length);
                }
                set_cursor_position(next_line_length, g_cursor_position.y + 1);
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
                        g_text_buffer[g_cursor_position.y].remove_char_at(g_cursor_position.x);
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
                
            case " ":
                write_text(" ", true);
            default: 
                console.log("Unrecognized Nav Key");
                console.log(key); 
            }
    }
}

function draw_math_symbol(row, column) {
    if (g_text_buffer[row].text[column].draw !== undefined) {
        g_text_buffer[row].text[column].draw();
    }
    else {
        console.error("Cannot draw non-symbol at position ", row, column);
    }
}

function arrow_key_pressed(key) {
    if (!key.shiftKey) {
        deselect_text();
    }
    switch (key.key) {
        case "ArrowRight":
            if (key.shiftKey) {
                if (!something_is_selected()) {
                    g_text_buffer[g_cursor_position.y].selection.start = g_cursor_position.x;
                    g_text_buffer[g_cursor_position.y].selection.end = g_cursor_position.x;
                }
                increment_selection_position(1, 0);
                increment_cursor_position(1, 0);
            }
            else if (g_cursor_position.x === g_text_buffer[g_cursor_position.y].char_length() && g_text_buffer.length !== 1 && g_cursor_position.y !== g_text_buffer.length-1) {
                g_cursor_position.x = 0; 
                increment_cursor_position(0, 1);
            }
            else {
                increment_cursor_position(1, 0);
            }
            break;
        case "ArrowLeft":
            if (key.shiftKey) {
                if (!something_is_selected()) {
                    g_text_buffer[g_cursor_position.y].selection.start = g_cursor_position.x;
                    g_text_buffer[g_cursor_position.y].selection.end = g_cursor_position.x;
                }
                increment_selection_position(-1, 0);
                increment_cursor_position(-1, 0);
            }
            else if (g_cursor_position.x === 0 && g_cursor_position.y !== 0) {
                g_cursor_position.x = g_text_buffer[g_cursor_position.y-1].char_length(); 
                increment_cursor_position(0, -1);
            }
            else {
                increment_cursor_position(-1, 0);
            }
            break;
        case "ArrowUp":
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
            break;
        case "ArrowDown":
            if (key.shiftKey) {
                if (g_cursor_position.y != g_text_buffer.char_length() - 1) {
                    if (!something_is_selected()) {
                        start_selection_at(g_cursor_position);
                    }
                    increment_selection_position(0, 1);
                    increment_cursor_position(0, 1);
                }
            }
            else if (g_cursor_position.y === g_text_buffer.length-1) {
                g_cursor_position.x = g_text_buffer[g_cursor_position.y].char_length(); 
                update_cursor();
            }
            else {
                increment_cursor_position(0, 1);
            }    
    }
}


function key_pressed(key, append_to_buffer) {
    if (g_state === states.create_symbol && g_current_symbol === "" && g_text_buffer[g_cursor_position.y].is_symbol(g_cursor_position.x)) {
        g_state = states.edit_symbol;
        g_current_symbol_position.x = g_cursor_position.x;
        g_current_symbol_position.y = g_cursor_position.y;
    }
    if (key.key === "\\" || key.key === "/" || key.key === "_") {
        g_current_symbol_position.x = g_cursor_position.x;
        g_current_symbol_position.y = g_cursor_position.y;
        g_state = states.create_symbol;
    }


    if (g_state === states.create_symbol) {
        identify_math_symbol(key);
    }
    else if (g_state === states.edit_symbol) {
        edit_math_symbol(key);
    }
    else if (!is_text_key(key)) {
        navigate(key);
        g_state = states.navigation;
        return;
    }
    else {
        write_text(key.key, append_to_buffer);
    }
}


function write_text(text, append_to_buffer) {
    if (text.draw !== undefined) {
        var scale = text.get_cursor_scale(text.get_pos_from_cursor(), 0);
        console.log(scale, g_cursor_scale);
        scale_cursor(scale.x, scale.y);
        console.log(g_cursor_scale);
        text.draw();
        unscale_cursor(scale.x, scale.y);
        return;
    }

    if (text.length !== 1 && text.startsWith('\\')) {
        draw_math_symbol(text, g_cursor_position.y, g_cursor_position.x);
        return;
    }
    else if (text.startsWith('{')) {
        return;
    }
    g_ctx.fillText(text, get_cursor_x_in_pixels(), get_cursor_y_in_pixels());
    if (append_to_buffer) {
        if (something_is_selected()) {
            delete_selected();
        }
        insert_letter_at_cursor(text);
    }
    else {
        g_cursor_position.x++;
    }
    return;
}


function load() {
    document.querySelector("#editor").width = window.innerWidth;   // Set the width of the canvas to the width of the window
    document.querySelector("#editor").height = window.innerHeight;  // Same with the height
    g_canvas = document.getElementById("editor");
    g_ctx = g_canvas.getContext('2d');

    window.addEventListener('keydown', key_pressed_listener, false);
    window.addEventListener('mousedown', mouse_click_listener);

    g_ctx.font = font_size + "px " + font_name;
    g_ctx.fillStyle = text_color;
    g_ctx.strokeStyle = text_color
    g_ctx.imageSmoothingEnabled = false;
    g_ctx.textAlign = "center";

    calculate_max_letter_size();

    g_letter_spacing = g_ctx.measureText('w').width;
    g_cursor_size.y = max_height;
    g_cursor_size.x = 2;

    g_cursor_interval = setInterval(draw_cursor, cursor_blink_speed);
}

class symbol {
    row;
    column;
    name;
    args = [];

    constructor(row, column, name) {
        if (row === undefined) {
            this.row = g_cursor_position.y;
        }
        else {
            this.row = row;
        }
        if (column === undefined) {
            this.column = g_cursor_position.x;
        }
        else {
            this.column = column;
        }
        this.name = name;
        //g_text_buffer[this.row].text.splice(this.column, 0, this);
    }

    displayed_length() { symbol.instance_error();  return 0; }

    insert(element, pos, arg) {
        this.args[arg].splice(pos, 0, element);
    }

    delete(pos, arg) {
        this.args[arg].splice(pos, 1);
    }

    
    // TODO: SCALE BEFORE CALLING THIS METHOD
    draw(row, column) { symbol.instance_error(); }

    get_pos_from_cursor() { 
        if (g_cursor_position.y !== this.row) {
            return -1;
        }

        return g_cursor_position.x - this.column; 
    }

    get_cursor_scale(pos, arg) { return new point(1, 1); }

    get_cursor_offset(pos, arg) { return new point(0, 0); }

    to_string() { 
        var out = this.name;
        for (var i = 0; i < this.args.length; i++) {
            out += "{";
            for (var j = 0; j < this.args[i].length; j++) {
                out += this.args[i][j];
            }
            out += "}";
        }
        return out;
    }

    static instance_error() {
        console.log("ERROR: Instance of base symbol is not supported");
    }

    static create_symbol(id, row, column) {
        return new symbol_constructors[id](row, column);
    }
    
    static is_valid(symbol) { 
        if (symbol.draw !== undefined) {
            return true;
        }
    
        return symbol_constructors[symbol] !== undefined;
    }
    
}



class nrt extends symbol {
    constructor(row, column) { 
        super(row, column, "\\nrt");
        this.args.push([], []);
    }

    displayed_length() {
        return this.args[0].length + this.args[1].length + 1;
    }

    draw(row, column) {

    }
}

class sqrt extends symbol {
    constructor(row, column) { 
        super(row, column, "\\sqrt");
        this.args.push([]);
    }

    displayed_length() {
        return this.args[0].length + 1;
    }


    draw(row, column) { 
        if (row === undefined) {
            row = g_cursor_position.x;
        }
        if (column === undefined) {
            column = g_cursor_position.y;
        }

        write_text('√');            
        g_ctx.beginPath();
        g_ctx.moveTo(cursor_x_to_pixels(column) + g_ctx.measureText('√').width/2, cursor_y_to_pixels(row) - g_ctx.measureText('√').actualBoundingBoxAscent); // Draw the covering line
        g_ctx.lineTo(cursor_x_to_pixels(column + this.args[0].length) + g_ctx.measureText('√').width/2, cursor_y_to_pixels(row) - g_ctx.measureText('√').actualBoundingBoxAscent);
        g_ctx.closePath();
        g_ctx.stroke();             
        for (var i = 0; i < this.args[0].length; i++) {
            write_text(this.args[0][i], false);
        }
    }
}


class frac extends symbol {
    constructor(row, column) {
        super(row, column, "\\frac");
        this.args.push([], []);
    }

    displayed_length() { return Math.max(this.args[0].length, this.args[1].length); }


    draw(row, column) { 
        if (row === undefined) {
            row = g_cursor_position.y;
        }
        if (column === undefined) {
            column = g_cursor_position.x;
        }
        var tot_length = this.args[0].length + this.args[1].length;
        var numerator_off = Math.max(0, (tot_length/2) - (this.args[0].length));
        var denom_off = Math.max(0, (this.args[0].length) - (tot_length/2));
        g_cursor_position.y-=.5;
        g_cursor_position.x += numerator_off;
        g_ctx.beginPath();
        g_ctx.moveTo(g_cursor_position_x_to_pixels(column-1), g_cursor_position_y_to_pixels(row) - g_ctx.measureText('1').actualBoundingBoxAscent/2); // Draw the covering line
        g_ctx.lineTo(g_cursor_position_x_to_pixels(column-.5 + this.displayed_length()), g_cursor_position_y_to_pixels(row) - g_ctx.measureText('1').actualBoundingBoxAscent/2);
        g_ctx.closePath();
        g_ctx.stroke();
        for (var i = 0; i < this.args[0].length; i++) {
            write_text(this.args[0][i], false);
        }
        g_cursor_position.y++;
        if (this.args.displayed_length !== undefined) {
            g_cursor_position.x -= (this.args[0].displayed_length()) + numerator_off;
        }
        else {
            g_cursor_position.x -= (this.args[0].length) + numerator_off;
        }
        g_cursor_position.x += denom_off;
        for (var i = 0; i < this.args[1].length; i++) {
            write_text(this.args[1][i], false);
        }
        g_cursor_position.x++;
        g_cursor_position.y-=.5;
    }

    get_cursor_scale(pos, arg) { 
        return new point(1, 0.5);    
    }

    get_cursor_offset(pos, arg) { 
        if (arg === 0) { 
            return new point(0, -0.5);
        }
        else { 
            return new point(0, 0.5);
        }
    }
}

class subscript extends symbol {
    constructor(row, column) {
        super(row, column, "_");
        this.args.push([]);
    }

    displayed_length() {
        return this.args[0].length;
    }

    get_cursor_scale() {
        return new point(1, .5);
    }

    draw() {        
        for (var i = 0; i < this.args[0].length; i++) {
            write_text(this.args[0][i], false);
        }
    }
}


class pi extends symbol {
    constructor(row, column) {
        super(row, column, "\\pi");
    }

    displayed_length() {
        return 1;
    }


    draw() {
        write_text('π', false);
    }
}

class theta extends symbol {
    constructor(row, column) {
        super(row, column, "\\theta");
    }

    displayed_length() {
        return 1;
    }

    draw() {
        write_text('θ', false);
    }
}


const symbol_constructors = {
    "\\sqrt" : sqrt, 
    "\\nrt" : nrt, 
    "\\frac" : frac,
    "_" : subscript,
    "\\pi" : pi, 
    "\\theta" : theta, 
}