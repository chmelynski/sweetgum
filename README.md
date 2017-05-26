# Sweetgum

A tree viewer for JSON data

## Features

Sweetgum renders to a canvas for speed, and can be controlled with the keyboard alone without using a mouse.

## Demo

[https://chmelynski.github.io/sweetgum/sweetgum.htm](https://chmelynski.github.io/sweetgum/sweetgum.htm)

## Usage

    // include a tabIndex so that the canvas can be focused
    <canvas id="canvas" width="1000" height="500" tabIndex="1"></canvas>
    
    var ctx = document.getElementById('canvas').getContext('2d');
    ctx.canvas.focus(); // focus the canvas so that it can receive key events
    
    var data = {a:'foo',b:[{a:'foo'},'baz'],c:['bar','baz']};
    
    var options = {
    	top: 20,
    	left: 50,
    	indent: 20,
    	handleRadius: 5,
    	textMargin: 15,
    	twigHeight: 15,
    	maxVisible: 30,
    	font: '10pt Courier New',
    	drawHandle: null // a suitable default drawHandle function is built in
    };
    
    var tree = new Sweetgum.Tree(ctx, data, options);

## Options

Note: a "twig" refers to one row of the tree.  A twig has a handle that can be clicked to open/close the subtree, and a text that displays the key and value of the relevant object/array element.
    
- `top`: the y-position of the center of the root handle
- `left`: the x-position of the center of the root handle
- `indent`: size of one unit of indentation
- `handleRadius`: only used for determining whether a click hits the handle - it should play well with your drawHandle function
- `textMargin`: distance between handle center and twig text
- `twigHeight`: vertical spacing between twigs
- `maxVisible`: number of twigs to display, if canvas size permits
- `font`: font of twig text
- `drawHandle`: `function(ctx: CanvasRenderingContext2D, tree: Tree, twig: Twig, cx: number, cy: number)` - custom drawing function to draw a twig handle, given the twig and its center coordinates as parameters (as well as the context and the tree)

## Controls

    Space = edit value
    Shift+Space = edit key
    
    Up = move cursor up (in display order)
    Down = move cursor down (in display order)
    Shift+Up = move cursor to prev sibling
    Shift+Down = move cursor to next sibling
    Ctrl+Up = move cursor to parent
    Ctrl+Shift+Up = move cursor to root
    
    Click = select twig, and open or close branch
    
    Right = open, or move cursor to next
    Left = close, or move cursor to parent
    Ctrl+Right = open descendants
    Ctrl+Left = close descendants
    Shift+Right = open children
    Shift+Left = close children
    Ctrl+Shift+Right = open children and descendants
    Ctrl+Shift+Left = close children and descendants
    Shift+Alt+Right = open grandchildren
    Shift+Alt+Left = close grandchildren
    Ctrl+Shift+Alt+Right = open grandchildren and descendants
    Ctrl+Shift+Alt+Left = close grandchildren and descendants
    
    Alt+Up = add prev sibling
    Alt+Down = add next sibling
    Alt+Left = add object parent
    Alt+Shift+Left = add array parent
    Alt+Right = add first child
    Shift+Alt+Up = switch selected with prev sibling
    Shift+Alt+Down = switch selected with next sibling
    
    Shift+Scroll = scroll by 1 twig
    Scroll = 10
    Ctrl+Scroll = 100
    Ctrl+Shift+Scroll = 1000
    Ctrl+Shift+Alt+Scroll = 10000
    PageUp/PageDown is equivalent to Scroll
