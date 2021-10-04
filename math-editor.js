const bg_color = "#212529";
const text_color = "#6c757d";

var font_name;
const font_size = 30;


const selection_alpha = 0.35;

var max_height = 0;
var max_width = 0;

const cursor_blink_speed = 500;


class point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}


const letter_space = new point(0, 5);
const default_position = new point(15, 25);


var g_text_buffer = [[]]; /// TODO: Make custom row objects for each row of text
var g_cursor_position = new point(0, 0);
var g_cursor_visible = true;
var g_cursor_interval;
var g_cursor_size = new point(0, 0);
var g_letter_spacing;
var g_selection_start = new point(-1, -1);
var g_selection_end = new point(-1, -1);
var g_canvas;
var g_ctx;


class key_press {
    constructor(key) {
        this.key = key;
    }
}

function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

function set_cursor_position(x, y) {
    y = clamp(y, 0, g_text_buffer.length-1);
    x = clamp(x, 0, g_text_buffer[y].length);

    g_cursor_position.x = x;
    g_cursor_position.y = y;
    reload_buffer();
    draw_cursor();
    clearInterval(g_cursor_interval);
    g_cursor_interval = setInterval(draw_cursor, cursor_blink_speed);
}

function increment_cursor_position(x, y) {
    y = clamp(y, -g_cursor_position.y, g_text_buffer.length-1 - g_cursor_position.y);
    x = clamp(x, -g_cursor_position.x, g_text_buffer[g_cursor_position.y + y].length - g_cursor_position.x);

    g_cursor_position.x += x;
    g_cursor_position.y += y;
    reload_buffer();
    draw_cursor();
    clearInterval(g_cursor_interval);
    g_cursor_interval = setInterval(draw_cursor, cursor_blink_speed);
}

function select_row(row) {
    start.x = 0;
    start.y = row;
    end.x = g_text_buffer[row].length;
    end.y = row;
}

function deselect_text() {
    g_selection_start.x = -1;
    g_selection_start.y = -1;
    g_selection_end.x = -1;
    g_selection_end.y = -1;
    reload_buffer();
}

function set_text_selected(from, to) {
    g_selection_start.x = from.x;
    g_selection_start.y = from.y;
    g_selection_end.x = to.x;
    g_selection_end.y = to.y;
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

function something_is_selected() {
    return g_selection_start.x !== -1 && g_selection_start.y !== -1 && g_selection_end.x !== -1 && g_selection_end.y !== -1;
}

function insert_letter_at_cursor(key) {
    g_text_buffer[g_cursor_position.y].splice(g_cursor_position.x, 0, new key_press(key));
    increment_cursor_position(1, 0);
    reload_buffer();
}

function delete_selected() {
    if (something_is_selected()) {
        var start_y = clamp(Math.min(g_selection_start.y, g_selection_end.y), 0, g_text_buffer.length);
        var start_x = clamp(Math.min(g_selection_start.x, g_selection_end.x), 0, g_text_buffer[start_y].length);
        var end_y = clamp(Math.max(g_selection_start.y, g_selection_end.y), 0, g_text_buffer.length);
        var end_x = clamp(Math.max(g_selection_start.x, g_selection_end.x), 0, g_text_buffer[end_y].length);
        console.log(start_x, start_y, end_x, end_y);
        for (var i = start_y; i <= end_y; i++) {
            for (var j = start_x; j <= end_x; j++) {
                g_text_buffer[i].splice(start_x, 1);
            }
        }
    }

    g_selection_start.x = -1;
    g_selection_start.y = -1;
    g_selection_end.x = -1;
    g_selection_end.y = -1;
}

function position_of_first_selected_letter() {
    if (something_is_selected()) {
        return g_selection_start;
    }
    return undefined;
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

function draw_selection(start_point, end_point) {
    if (start_point.x !== -1 && start_point.y !== -1) {
        g_ctx.globalAlpha = selection_alpha;
        g_ctx.beginPath();
        g_ctx.rect(cursor_x_to_pixels(start_point.x)-g_letter_spacing/2, cursor_y_to_pixels(start_point.y) - max_height, cursor_x_to_pixels(end_point.x) + g_letter_spacing/2, (end_point.y + 1) * g_cursor_size.y);
        g_ctx.fill();
        g_ctx.globalAlpha = 1;
    }
}

function reload_buffer() {
    const pushed_cursor_position_x = g_cursor_position.x;
    const pushed_cursor_position_y = g_cursor_position.y;
    g_cursor_position.x = 0, g_cursor_position.y = 0;

    // Write key presses to the canvas.
    g_ctx.clearRect(0, 0, window.innerWidth*2, window.innerHeight*2); // Clear the canvas
    for (var i = 0; i < g_text_buffer.length; i++) {
        for (var j = 0; j < g_text_buffer[i].length; j++) {
            write_key(g_text_buffer[i][j].key, false); // Simulate the key presses of the buffer without appending to the buffer
        }
        g_cursor_position.y++;
        g_cursor_position.x = 0;
    }

    g_cursor_position.x = pushed_cursor_position_x;
    g_cursor_position.y = pushed_cursor_position_y;

    // Highlight Selected Text
    if (something_is_selected()) {
        var start_y = clamp(Math.min(g_selection_start.y, g_selection_end.y), 0, g_text_buffer.length);
        var start_x = clamp(Math.min(g_selection_start.x, g_selection_end.x), 0, g_text_buffer[start_y].length);
        var end_y = clamp(Math.max(g_selection_start.y, g_selection_end.y), 0, g_text_buffer.length);
        var end_x = clamp(Math.max(g_selection_start.x, g_selection_end.x), 0, g_text_buffer[end_y].length);
        draw_selection(new point(start_x, start_y), new point(end_x, end_y));
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
                g_selection_end.x = g_text_buffer[g_text_buffer.length-1].length-1; /// FIXME: We should find the max row width instead 
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
                    console.log(g_selection_start);
                    console.log(g_selection_end);
                    g_selection_start.x = g_cursor_position.x;
                    g_selection_start.y = g_cursor_position.y;
                    g_selection_end.x = g_cursor_position.x+1;
                    g_selection_end.y = g_cursor_position.y;
                }
                else {
                    g_selection_end.x++;
                }
            }
            increment_cursor_position(1, 0);
        }
        else if (key.key == 'ArrowLeft') {
            if (key.shiftKey) {
                if (!something_is_selected()) {
                    console.log(g_selection_start);
                    console.log(g_selection_end);
                    g_selection_start.x = g_cursor_position.x;
                    g_selection_start.y = g_cursor_position.y;
                    g_selection_end.x = g_cursor_position.x-1;
                    g_selection_end.y = g_cursor_position.y;
                }
                else {
                    g_selection_end.x--;
                }
            }
            increment_cursor_position(-1, 0);
        }
        else if (key.key == 'ArrowUp') {
            if (key.shiftKey) {
                if (!something_is_selected()) {
                    g_selection_start.x = g_cursor_position.x;
                    g_selection_start.y = g_cursor_position.y;
                    g_selection_end.x = g_cursor_position.x;
                    g_selection_end.y = g_cursor_position.y-1;
                }
                else {
                    g_selection_end.y--;
                }
            }
            increment_cursor_position(0, -1);
        }
        else if (key.key == 'ArrowDown') {
            if (key.shiftKey) {
                if (!something_is_selected()) {
                    g_selection_start.x = g_cursor_position.x;
                    g_selection_start.y = g_cursor_position.y;
                    g_selection_end.x = g_cursor_position.x;
                    g_selection_end.y = g_cursor_position.y+1;
                }
                else {
                    g_selection_end.y++;
                }
            }
            increment_cursor_position(0, 1);
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
                g_text_buffer.splice(g_cursor_position.y + 1, 0, []);
                var next_line_length = g_text_buffer[g_cursor_position.y + 1].length
                if (g_cursor_position.x !== g_text_buffer[g_cursor_position.y].length-1) {   // If the cursor is not at the end of the buffer move everything after 
                                                                        // the cursor to the new line.
                    var after_newline = g_text_buffer[g_cursor_position.y].slice(g_cursor_position.x);
                    g_text_buffer[g_cursor_position.y + 1].push.apply(g_text_buffer[g_cursor_position.y + 1], after_newline);
                    g_text_buffer[g_cursor_position.y].splice(g_cursor_position.x, after_newline.length);
                }
                set_cursor_position(next_line_length, g_cursor_position.y + 1);
            }
            else {
                g_cursor_position.y++;
                g_cursor_position.x = 0;
            }
            return;
        case "Backspace":
            if (something_is_selected) {
                delete_selected();
            }
            else {
                if (g_cursor_position.x === 0 && g_cursor_position.y === 0) { return; } // Ignore a backspace at the beginning of the screen
                if (g_cursor_position.x === 0) {
                    previous_line_length = g_text_buffer[g_cursor_position.y - 1].length;
                    g_text_buffer[g_cursor_position.y - 1].push.apply(g_text_buffer[g_cursor_position.y-1], g_text_buffer[g_cursor_position.y]);
                    g_text_buffer.splice(g_cursor_position.y, 1);
                    set_cursor_position(previous_line_length, g_cursor_position.y - 1);
                }
                else {
                    g_text_buffer[g_cursor_position.y].splice(g_cursor_position.x-1, 1);
                    increment_cursor_position(-1, 0);
                }
            }
            reload_buffer();
            return;
        case "Delete":
            if (something_is_selected) {
                delete_selected();
            }
            else {
                g_text_buffer[g_cursor_position.y].splice(g_cursor_position.x + 1, 1);
                if (g_cursor_position.x === 0) {
                    previous_line_length = g_text_buffer[g_cursor_position.y - 1].length;
                    g_text_buffer[g_cursor_position.y + 1].push.apply(g_text_buffer[g_cursor_position.y + 1], g_text_buffer[g_cursor_position.y]);
                    g_text_buffer.splice(g_cursor_position.y, 1);
                    set_cursor_position(previous_line_length, g_cursor_position.y + 1);
                }
                else {
                    increment_cursor_position(1, 0);
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