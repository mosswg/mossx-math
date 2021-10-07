const bg_color = "#212529";
const text_color = "#6c757d";

var font_name;
const font_size = 30;


const selection_alpha = 0.35;

var max_height = 0;
var max_width = 0;

const cursor_blink_speed = 300;

const states = {
    text: write_text,
    navigation: navigate,
    create_symbol: create_math_symbol,
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
        this.selection.end = -1;     ///        We really shouldn't be adding imaginary fields to a point object. But x and y don't make sense for this object
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
            if (this.text[i].startsWith('\\')) {
                if (this.text[i] === "\\frac") {
                    length += Math.max(this.text[i+1].length, this.text[i+2].length)-2;
                    i+=2;
                    continue;
                }
                length++;
            }
            else {
                length += this.text[i].length;
            }

            if (this.text[i].length !== 1 && this.text[i].startsWith('{')) {
                length-=2;
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


    remove_char_at(idx) {
        var curr = 0;
        for (var i = 0; i < this.char_length(); curr++) {
            if (idx <= line.get_modified_length(this.text[curr]) + i) {
                if (this.text[curr].length !== 1 && !is_valid_symbol(this.text[curr])) {
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
                if (this.text[curr].length !== 1 && (!is_valid_symbol(this.text[curr]) && !this.text[curr].startsWith("{"))) {
                    return false;
                }
                else {
                    return this.text[curr].startsWith("\\") ||  this.text[curr].startsWith("{");
                }
            }
            else {
                i += line.get_modified_length(this.text[curr]);
            }
        }
        
    }



    /**
     * @param {String} text The text whose length will be gotten.
     * @returns {Number} the length of the text as it is displayed.
     */
    static get_modified_length(text) {
        if (is_valid_symbol(text)) {
            return 1;
        }
        
        if (text.startsWith("{")) {
            return text.length - 2;
        }
        
        return text.length;
    }
}

class math_symbol {
    constructor(construct, draw) {
        this.construct = construct;
        this.draw = draw;
    }



    static draw_sqrt(row, column) {
        if (!(g_text_buffer[row].text[column+1].startsWith('{'))) {
            write_text('√');
            g_ctx.beginPath();
            g_ctx.moveTo(cursor_x_to_pixels(column), cursor_y_to_pixels(row) + max_height); // Draw the covering line
            g_ctx.lineTo(cursor_x_to_pixels(column+1), cursor_y_to_pixels(row) + max_height);
            g_ctx.stroke();
            if (!is_valid_symbol(g_text_buffer[row].text[column+1])) {
                write_text(g_text_buffer[row].text[column+1]);
            }
            else {
                valid_math_symbols[g_text_buffer[row].text[column+1]]();
            }
        }
        else {
            write_text('√');            
            if (g_text_buffer[row].text[column+1].length === 1) { // if pasted from a separate source they will be single characters whereas from us they will be in string format
                var num_curly = 1;
                var end_curly = -1;
                for (i = column+2; i < g_text_buffer[row].length(); i++) {
                    if (g_text_buffer[row].text[i] === '{') {
                        num_curly++;
                    }
                    else if (g_text_buffer[row].text[i] === '}') {
                        num_curly--;
                    }
    
                    if (num_curly === 0) { 
                        end = i;
                    }
                }
                if (end === -1) {
                    console.error("Error: Missing End Curly Bracket");
                    return;
                }
                g_ctx.beginPath();
                g_ctx.moveTo(cursor_x_to_pixels(column) + g_ctx.measureText('√').width/2, cursor_y_to_pixels(row) - max_height); // Draw the covering line
                g_ctx.lineTo(cursor_x_to_pixels(end_curly) + g_ctx.measureText('√').width/2, cursor_y_to_pixels(row) - max_height);
                g_ctx.stroke();
                
                for (var i = column+2; i < end_curly; i++) {
                    write_text(g_text_buffer[row].text[i], false);
                }
            }
            else {
                g_ctx.beginPath();
                g_ctx.moveTo(cursor_x_to_pixels(column) + g_ctx.measureText('√').width/2, cursor_y_to_pixels(row) - max_height); // Draw the covering line
                g_ctx.lineTo(cursor_x_to_pixels(column + g_text_buffer[row].text[column+1].length-2) + g_ctx.measureText('√').width/2, cursor_y_to_pixels(row) - max_height);
                g_ctx.closePath();
                g_ctx.stroke();             
                for (var i = 1; i < g_text_buffer[row].text[column+1].length-1; i++) {
                    write_text(g_text_buffer[row].text[column+1].charAt(i), false);
                }
            }
            
        }
    }

    static create_sqrt(key) {
        if (key.key == "Enter" || key.key == "Tab") { // Check if we should stop creating the sqrt
            g_text_buffer[g_current_symbol_position.y].text.splice(g_current_symbol_position.x, 0, "\\" + g_current_symbol);
            g_text_buffer[g_current_symbol_position.y].text.splice(g_current_symbol_position.x + 1, 0, "");
            for (var i = 0; i < g_tmp_buffer.length; i++) {
                g_text_buffer[g_current_symbol_position.y].text[g_current_symbol_position.x + 1] += g_tmp_buffer[i];
            }
            g_text_buffer[g_current_symbol_position.y].text[g_current_symbol_position.x + 1] += '}';
            return false;
        }
        reload_buffer();
        var cursor_x = g_cursor_position.x + 1;
        g_cursor_position.x = g_current_symbol_position.x;
        write_text('√', false);
        if (g_tmp_buffer === "") {
            g_tmp_buffer = "{"
            return true;
        }      
        if (key.key == "Backspace") {
            if (g_tmp_buffer === "{") {
                g_text_buffer[g_current_symbol_position.y].text.splice(g_current_symbol_position.x + 1, 1);
                reload_buffer();
                g_current_symbol = "";
                g_tmp_buffer = "";
                g_reading_math_symbol = false;
            }
            cursor_x-=2;
            g_tmp_buffer = g_tmp_buffer.substring(0, g_tmp_buffer.length-1);
        }
        else {
            g_tmp_buffer += key.key;
        }
        g_ctx.beginPath();
        g_ctx.moveTo(cursor_x_to_pixels(g_current_symbol_position.x) + g_ctx.measureText('√').width/2, get_cursor_y_in_pixels() - max_height); // Draw the covering line
        g_ctx.lineTo(cursor_x_to_pixels(g_current_symbol_position.x + g_tmp_buffer.length-1) + g_ctx.measureText('√').width/2, get_cursor_y_in_pixels() - max_height);
        g_ctx.closePath();
        g_ctx.stroke();

        for (var i = 1; i < g_tmp_buffer.length; i++) {
            write_text(g_tmp_buffer[i], false);
        }
        g_cursor_position.x = cursor_x;
        return true;        
    }

    static draw_nrt(row, column) {
        if (g_text_buffer[row].text[column+1] !== '{') {
            draw_sqrt(row, column);
        }
        else {
            
        }
    }


    static create_frac(key) {
        reload_buffer();
        var pushed_cursor_position_x = g_cursor_position.x;
        if (!g_tmp_buffer.startsWith("{")) {
            g_tmp_buffer = "{";
            return true;
        }
        scale_cursor(1, .5);

        if (g_tmp_buffer.indexOf('}') !== -1) { // If the first part of the fraction is complete
            var numerator_length = g_tmp_buffer.indexOf("}") + 1;
            var length = Math.max(numerator_length-2, (g_tmp_buffer.length-2) - (numerator_length-2));
            var numerator_off = Math.max(0, (g_tmp_buffer.length/2) - (numerator_length-1));
            var denom_off = Math.max(0, (numerator_length-1) - (g_tmp_buffer.length/2));
            if (g_tmp_buffer.endsWith("}")) {
                g_tmp_buffer += "{";
            }
            if (key.key === "Enter" || key.key === "Tab") {
                scale_cursor(1, 2);
                increment_cursor_position(1, 0);
                g_text_buffer[g_current_symbol_position.y].text.splice(g_current_symbol_position.x, 0, "\\" + g_current_symbol);
                g_text_buffer[g_current_symbol_position.y].text.splice(g_current_symbol_position.x + 1, 0, "");
                for (var i = 0; i < numerator_length; i++) {
                    g_text_buffer[g_current_symbol_position.y].text[g_current_symbol_position.x + 1] += g_tmp_buffer[i];
                }
                g_text_buffer[g_current_symbol_position.y].text.splice(g_current_symbol_position.x + 2, 0, "");
                for (var i = 0; i < g_tmp_buffer.length - numerator_length; i++) {
                    g_text_buffer[g_current_symbol_position.y].text[g_current_symbol_position.x + 2] += g_tmp_buffer[i + numerator_length];
                }
                g_text_buffer[g_current_symbol_position.y].text[g_current_symbol_position.x + 2] += '}';
                return false;
            }
            g_cursor_position.y-=.5;
            g_cursor_position.x += numerator_off;        
            g_ctx.beginPath();
            g_ctx.moveTo(cursor_x_to_pixels(g_current_symbol_position.x-1), get_cursor_y_in_pixels() + g_ctx.measureText(key).actualBoundingBoxAscent/2); // Draw the covering line
            g_ctx.lineTo(cursor_x_to_pixels(g_current_symbol_position.x-.5 + length), get_cursor_y_in_pixels() + g_ctx.measureText(key).actualBoundingBoxAscent/2);
            g_ctx.closePath();
            g_ctx.stroke();
            for (var i = 0; i < g_tmp_buffer.length; i++) {
                if (g_tmp_buffer[i] === '}') {
                    g_cursor_position.y++;
                    g_cursor_position.x -= (i-1) + numerator_off;
                    g_cursor_position.x += denom_off;
                    i++;
                    continue;
                }
                write_text(g_tmp_buffer[i], false);
            }
            if (is_text_key(key))
                write_text(key.key, false);
            g_cursor_position.y-=.5;
            g_cursor_position.x = pushed_cursor_position_x;
        }
        else {
            if (key.key === "ArrowDown" || key.key === "Enter") {
                g_tmp_buffer += "}";
                increment_cursor_position(0, -1);
                scale_cursor(1, 2);
                return math_symbol.create_frac(key);
            }
            g_cursor_position.y-=.5;
            g_ctx.beginPath();
            g_ctx.moveTo(cursor_x_to_pixels(g_current_symbol_position.x-1), get_cursor_y_in_pixels() + g_ctx.measureText(key).actualBoundingBoxAscent/2); // Draw the covering line
            g_ctx.lineTo(cursor_x_to_pixels(g_current_symbol_position.x-.5 + g_tmp_buffer.length), get_cursor_y_in_pixels() + g_ctx.measureText(key).actualBoundingBoxAscent/2);
            g_ctx.closePath();
            g_ctx.stroke();
            for (var i = 0; i < g_tmp_buffer.length; i++) {
                write_text(g_tmp_buffer[i], false);
            }
            if (is_text_key(key))
                write_text(key.key, false);
            g_cursor_position.y+=.5;
            
            g_cursor_position.x = pushed_cursor_position_x;
        }
        if (is_text_key(key))
            g_tmp_buffer += key.key;
        scale_cursor(1, 2);
        return true;
    }

    static draw_frac(row, column) {
        scale_cursor(1, .5);
        var tot_length = g_text_buffer[row].text[column+1].length + g_text_buffer[row].text[column+2].length;
        var drawn_length = Math.max(g_text_buffer[row].text[column+1].length, g_text_buffer[row].text[column+2].length)-2;
        var numerator_off = Math.max(0, (tot_length/2) - (g_text_buffer[row].text[column+1].length));
        var denom_off = Math.max(0, (g_text_buffer[row].text[column+1].length) - (tot_length/2));
        g_cursor_position.y-=.5;
        g_cursor_position.x += numerator_off;
        g_ctx.beginPath();
        g_ctx.moveTo(cursor_x_to_pixels(g_current_symbol_position.x-1), get_cursor_y_in_pixels() + g_ctx.measureText('1').actualBoundingBoxAscent/2); // Draw the covering line
        g_ctx.lineTo(cursor_x_to_pixels(g_current_symbol_position.x-.5 + drawn_length), get_cursor_y_in_pixels() + g_ctx.measureText('1').actualBoundingBoxAscent/2);
        g_ctx.closePath();
        g_ctx.stroke();
        for (var i = 1; i < g_text_buffer[row].text[column+1].length-1; i++) {
            write_text(g_text_buffer[row].text[column+1].charAt(i), false);
        }
        g_cursor_position.y++;
        g_cursor_position.x -= (g_text_buffer[row].text[column+1].length - 2) + numerator_off;
        g_cursor_position.x += denom_off;
        for (var i = 1; i < g_text_buffer[row].text[column+2].length-1; i++) {
            write_text(g_text_buffer[row].text[column+2].charAt(i), false);
        }
        g_cursor_position.x++;
        g_cursor_position.y-=.5;
        scale_cursor(1, 2);
    }

    static create_pi() {
        g_text_buffer[g_current_symbol_position.y].text.splice(g_current_symbol_position.x, 0, "\\" + g_current_symbol);
        g_cursor_position.x++;
        return false;
    }

    static draw_pi() {
        write_text('π', false);
    }

    static create_theta() {
        g_text_buffer[g_current_symbol_position.y].text.splice(g_current_symbol_position.x, 0, "\\" + g_current_symbol);
        g_cursor_position.x++;
        return false;
    }

    static draw_theta() {
        write_text('θ', false);
    }

    static create_math_symbol(symbol, key) {
        return valid_math_symbols[symbol].construct(key);
    }
}

const valid_math_symbols = {
    "sqrt" : new math_symbol(math_symbol.create_sqrt, math_symbol.draw_sqrt),
    "nrt" : new math_symbol(math_symbol.create_nrt, math_symbol.draw_nrt),
    "frac": new math_symbol(math_symbol.create_frac, math_symbol.draw_frac),
    "pi": new math_symbol(math_symbol.create_pi, math_symbol.draw_pi),
    "theta": new math_symbol(math_symbol.create_theta, math_symbol.draw_theta)
}

function finish_math_symbol() {
    g_current_symbol = "".concat(g_tmp_buffer); // Copy the contents instead of storing a reference to the variable
    g_tmp_buffer = "";
    g_cursor_position.x -= g_current_symbol.length-1;
    create_math_symbol("");
}


const letter_space = new point(0, 5);
const default_position = new point(15, 25);


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

function is_valid_symbol(symbol) {
    if (symbol.startsWith('\\')) {
        symbol = symbol.substring(1); // Trim the leading backslash.
    }
    return valid_math_symbols[symbol] != undefined;
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
 * Draws the contents of g_text_buffer and the selected area to the g_ctx canvas.
 * 
 * TODO: Optimize for reloading single lines instead of the entire buffer.
 */
function reload_buffer() {
    const pushed_cursor_position_x = g_cursor_position.x;
    const pushed_cursor_position_y = g_cursor_position.y;
    g_cursor_position.x = 0, g_cursor_position.y = 0;

    // Write key presses to the canvas.
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

    // Highlight Selected Text
    if (something_is_selected()) {
        var start;
        var end;
        
        for (var i = 0; i < g_text_buffer.length; i++) { /// TODO: Optimize this
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

function create_math_symbol(key) {
    if (key.key == "\\") return;
    if (g_current_symbol !== "") { // After symbol type is chosen
        if (!math_symbol.create_math_symbol(g_current_symbol, key)) {
            g_current_symbol = "";
            g_tmp_buffer = "";
            g_state = states.text;
            reload_buffer();
        }
    }
    else { // Read symbol type
        if (key.key === "Backspace") {
            g_tmp_buffer = g_tmp_buffer.substring(0, g_tmp_buffer.length-2); // Remove last element
            reload_buffer();
            return;
        }


        g_tmp_buffer = g_tmp_buffer.concat(key.key);
        if (is_valid_symbol(g_tmp_buffer)) {
            finish_math_symbol(g_tmp_buffer);
        }
        else if (key.key === " ") { // If it's not a supported symbol write as plain text
            for (var i = 0; i < g_tmp_buffer.length; i++) {
                g_text_buffer[g_cursor_position.y].text.splice(g_cursor_position.x - g_tmp_buffer.length + i, 0, g_tmp_buffer[i]); 
            }
            g_tmp_buffer = "";
        }
        else {
            // Draw the keys without storing them.
            g_cursor_position.x = g_current_symbol_position.x;
            reload_buffer();
            for (var i = 0; i < g_tmp_buffer.length; i++) {
                write_text(g_tmp_buffer.charAt(i), false);
            }
        }
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

function draw_math_symbol(symbol, row, column) {
    symbol = symbol.substring(1).toLowerCase(); // Remove the backslash and ensure it's lowercase.

    if (is_valid_symbol(symbol)) {
        valid_math_symbols[symbol].draw(row, column);
    }
    else {
        for (var i = 0; i < symbol.length; i++) {
            write_text(symbol[i]);
        }
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
    reload_buffer();
}


function key_pressed(key, append_to_buffer) {
    if (g_state === states.create_symbol && g_current_symbol === "" && g_text_buffer[g_cursor_position.y].is_symbol(g_cursor_position.x)) {
        g_state = states.edit_symbol;
        g_current_symbol_position.x = g_cursor_position.x;
        g_current_symbol_position.y = g_cursor_position.y;
    }
    if (key.key === "\\") {
        g_state = states.create_symbol;
        g_current_symbol_position.x = g_cursor_position.x;
        g_current_symbol_position.y = g_cursor_position.y;
    }
    else if (key.key === "/") {
        g_state = states.create_symbol;
        g_current_symbol_position.x = g_cursor_position.x;
        g_current_symbol_position.y = g_cursor_position.y;
        g_current_symbol = "frac";
    }
    if (g_state === states.create_symbol) {
        create_math_symbol(key);
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


function write_text(key, append_to_buffer) {
    if (key.length !== 1 && key.startsWith('\\')) {
        draw_math_symbol(key, g_cursor_position.y, g_cursor_position.x);
        return;
    }
    else if (key.startsWith('{')) {
        return;
    }
    g_ctx.fillText(key, get_cursor_x_in_pixels(), get_cursor_y_in_pixels());
    if (append_to_buffer) {
        if (something_is_selected()) {
            delete_selected();
        }
        insert_letter_at_cursor(key);
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

    font_first_space = g_ctx.font.indexOf(' ');
    font_name = g_ctx.font.substring(font_first_space + 1);

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