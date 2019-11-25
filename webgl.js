"use strict";

/*
 * TO IMPLEMENT:
 * - movement of components. Parameters needed per component:
 * - period, amplitude and absolute phase of horizontal motion
 * - period, amplitude and absolute phase of vertical motion
 * - period, amplitude and absolute phase of brightness variation
 * - period, amplitude and absolute phase of sigma-x
 * - period, amplitude and absolute phase of sigma-y
 * - period, amplitude and absolute phase of PA
 *
 * - Polarisation of components. Parameters needed per component:
 * - fractional polarisation degree (0..1)
 * - PA of component polarisation
 * - period, amplitude and absolute phase of polarisation degree (amp can be negative for flip)
 * - period, amplitude and absolute phase of polarisation PA
 * */

// Variable that holds the locations of variables in the shader for us
var lc;

// Keep track of whether the mouse button is down
var l_mouse_is_down = false;
var r_mouse_is_down = false;
var mousestart_x, mousestart_y, mouselast_x, mouselast_y, mouseend_x, mouseend_y, mousemoved_x, mousemoved_y, mouse_dragging;

var currentLoc = new Float32Array([20.,50.,90.,130.,170.,200.,220.,270.,290.,330.]);
var gl;
var program;
var fps, fpsInterval, now, then, currentcounter;

var keyMode = 0;

var canvas, textcanvas, ctx;
var width;
var height;

var lambdasPerPixel = 5e8;
var radiansPerPixel = 1e-6 * 1./3600. * Math.PI/180.;
var windowSize = 600;

// We leave out left/right bracket, u&i, and o&p
// as those should operate more in discrete steps for now.
var up_pressed = false;
var down_pressed = false;
var left_pressed = false;
var right_pressed = false;
var w_pressed = false;
var s_pressed = false;
var a_pressed = false;
var d_pressed = false;
var q_pressed = false;
var e_pressed = false;
var r_pressed = false;
var f_pressed = false;
var t_pressed = false;
var g_pressed = false;
var y_pressed = false;
var h_pressed = false;
var b_pressed = false;
var n_pressed = false;
var z_pressed = false;
var x_pressed = false;
var c_pressed = false;
var v_pressed = false;
var j_pressed = false;
var comma_pressed = false;
var period_pressed = false;
var minus_pressed = false;
var equals_pressed = false;
var zero_pressed = false;

var lambdasPerPixel = 5e8;
var radiansPerPixel = 1e-6 * 1./3600. * Math.PI/180.;

var sourcetypes = [0,0,0,0,0,0,0,0,0,0];

var xes = [
  0.,0.,0.,0.,0.,0.,0.,0.,0.,0.
];

var yes = [
  0.,0.,0.,0.,0.,0.,0.,0.,0.,0.
];

var xsigmas = [
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel
];

var ysigmas = [
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel,
  50. * radiansPerPixel
];

// One array for all variable params for all source components.
// order: ampx, periodx, phasex, ampy, periody, phasey, amp/period/phase brightness, a/p/p sigmax, a/p/p sigmay, a/p/p PA
var variableparams = [
  0., 5000., 0. * Math.PI/5., 0., 5000., 0. * Math.PI/5. + Math.PI/2., 0., 6000., 0., 0., 3000., Math.PI/3., 0., 2500., Math.PI/5., 0., 7000., Math.PI/7.,
  0., 5000., 1. * Math.PI/5., 0., 5000., 1. * Math.PI/5. + Math.PI/2., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
  0., 5000., 2. * Math.PI/5., 0., 5000., 2. * Math.PI/5. + Math.PI/2., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
  0., 5000., 3. * Math.PI/5., 0., 5000., 3. * Math.PI/5. + Math.PI/2., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
  0., 5000., 4. * Math.PI/5., 0., 5000., 4. * Math.PI/5. + Math.PI/2., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
  0., 5000., 5. * Math.PI/5., 0., 5000., 5. * Math.PI/5. + Math.PI/2., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
  0., 5000., 6. * Math.PI/5., 0., 5000., 6. * Math.PI/5. + Math.PI/2., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
  0., 5000., 7. * Math.PI/5., 0., 5000., 7. * Math.PI/5. + Math.PI/2., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
  0., 5000., 8. * Math.PI/5., 0., 5000., 8. * Math.PI/5. + Math.PI/2., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
  0., 5000., 9. * Math.PI/5., 0., 5000., 9. * Math.PI/5. + Math.PI/2., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
];

var thetas = [
  0.,0.,0.,0.,0.,0.,0.,0.,0.,0.
];

var strengths = [
  1.,0.,0.,0.,0.,0.,0.,0.,0.,0.
];

var uvs = [
  1e7, 1e7,
  5e7, 5e7,
  1e8, 1e8,
  5e8, 5e8,
  1e9, 1e9,
  5e9, 5e9,
  1e10, 1e10,
  5e10, 5e10,
  1e11, 1e11,
  5e11, 5e11
];

var scale;
var fourierstrength = 6e18;
var imagestrength = 1.;
var sel = 0;

var redBalance = 0.6;
var greenBalance = 0.6;
var blueBalance = 0.6;

function InitializeShader(gl, source_vs, source_frag)
{
    var shader_vs = gl.createShader(gl.VERTEX_SHADER);
    var shader_frag = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(shader_vs, source_vs);
    gl.shaderSource(shader_frag, source_frag);

    gl.compileShader(shader_vs);
    gl.compileShader(shader_frag);

    var error = false;
    var ErrorMessage;

    // Compile vertex shader
    if (!gl.getShaderParameter(shader_vs, gl.COMPILE_STATUS)) {
        ErrorMessage += gl.getShaderInfoLog(shader_vs);
        error = true;
    }

    // Compile fragment shader
    if (!gl.getShaderParameter(shader_frag, gl.COMPILE_STATUS)) {
        ErrorMessage += gl.getShaderInfoLog(shader_frag);
        error = true;
    }

    // Create shader program consisting of shader pair
    var program = gl.createProgram();

    var ret = gl.getProgramInfoLog(program);

    if (ret != "")
        ErrorMessage += ret;

    // Attach shaders to the program; these methods do not have a return value
    gl.attachShader(program, shader_vs);
    gl.attachShader(program, shader_frag);

    // Link the program - returns 0 if an error occurs
    if (gl.linkProgram(program) == 0) {
        ErrorMessage += "\r\ngl.linkProgram(program) failed with error code 0.";
        error = true;
    }
 
    if (error)  {
        console.log(ErrorMessage + ' ...failed to initialize shader.');
        return false;
    } else {
        console.log(ErrorMessage + ' ...shader successfully created.');
        return program; // Return created program
    }
}

function keydown(e) {
  var keyCode = e.keyCode;
  e.preventDefault();
  if (keyCode == 37) left_pressed  = true;
  if (keyCode == 39) right_pressed = true;
  if (keyCode == 38) up_pressed    = true;
  if (keyCode == 40) down_pressed  = true;
  if (e.key == 'w') w_pressed      = true;
  if (e.key == 'a') {
    a_pressed = true;
    if (keyMode == 1) {
      variableparams[18 * sel + 0] = 0.; // Set x amplitude to zero
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) {
      variableparams[18 * sel + 9] = 0.; // Set sigma-x amplitude to zero
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) {
      variableparams[18 * sel + 6] = 0.; // Set brightness amplitude to zero
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }

  }
  if (e.key == 's') {
    s_pressed  = true;
    if (keyMode == 1) {
      variableparams[18 * sel + 1] = 1000.; // Set x period to default value
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) {
      variableparams[18 * sel + 10] = 1000.; // Set sigma-x period to default value
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) {
      variableparams[18 * sel + 7] = 1000.; // Set brightness period to default value
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }


  }
  if (e.key == 'd') {
    d_pressed = true;
    if (keyMode == 1) {
      variableparams[18 * sel + 2] = 0.; // Set abs x phase to default value
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) {
      variableparams[18 * sel + 11] = 0.; // Set sigma-x phase to default value
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) {
      variableparams[18 * sel + 8] = 0.; // Set brightness phase to default value
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }


  }

  if (e.key == 'e') e_pressed      = true;
  if (e.key == 'z') z_pressed      = true;
  if (e.key == 'x') x_pressed      = true;
  if (e.key == 'c') c_pressed      = true;
  if (e.key == 'v') v_pressed      = true;
  if (e.key == ',') comma_pressed  = true;
  if (e.key == '.') period_pressed = true;
  if (e.key == '-') minus_pressed  = true;
  if (e.key == '=') equals_pressed = true;
  if (e.key == 'q') {
    q_pressed = true;
    if (keyMode == 0) {
      sourcetypes[sel] = 1 - sourcetypes[sel];
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "sourcetypes");
      gl.uniform1iv(lc, sourcetypes);
      requestAnimationFrame(render);
    }
  }
  if (e.key == 'm') {
    xes[sel] = 0.;
    yes[sel] = 0.;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "xes");
    gl.uniform1fv(lc, xes);
    lc = gl.getUniformLocation(program, "yes");
    gl.uniform1fv(lc, yes);
    requestAnimationFrame(render);
  }
  if (e.key == 'n') {
    n_pressed = true;
    if (keyMode == 0) {
      strengths[sel] = 1.;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "strengths");
      gl.uniform1fv(lc, strengths);
      requestAnimationFrame(render);
    }
  }
  if (e.key == 'b') {
    b_pressed = true;
    if (keyMode == 0) {
      xsigmas[sel] = 50. * radiansPerPixel;
      ysigmas[sel] = 50. * radiansPerPixel;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "xsigmas");
      gl.uniform1fv(lc, xsigmas);
      lc = gl.getUniformLocation(program, "ysigmas");
      gl.uniform1fv(lc, ysigmas);
      requestAnimationFrame(render);
    }
  }
  if (e.key == 'r') {
    r_pressed = true;
    if (keyMode == 0) {
      redBalance = redBalance + 0.1;
      if (redBalance > 1.) redBalance = 1.;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "redBalance");
      gl.uniform1f(lc, redBalance);
    }
  }
  if (e.key == 'f') {
    if (keyMode == 1) {
      variableparams[18 * sel + 3] = 0.; // Set y-position dynamics amplitude to zero
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 0) { // lower red balance
      redBalance = redBalance - 0.1;
      if (redBalance < 0.5) redBalance = 0.5;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "redBalance");
      gl.uniform1f(lc, redBalance);
    } else if (keyMode == 2) {  // Set sigma-y dynamics amplitude to zero
      variableparams[18 * sel + 12] = 0.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) { // set PA dynamics amplitude to zero
      variableparams[18 * sel + 15] = 0.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
  }
  if (e.key == 't') {
    t_pressed = true;
    if (keyMode == 0) {
      greenBalance = greenBalance + 0.1;
      if (greenBalance > 1.) greenBalance = 1.;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "greenBalance");
      gl.uniform1f(lc, greenBalance);
    }
  }
  if (e.key == 'g') {
    if (keyMode == 1) {
      variableparams[18 * sel + 4] = 1000.; // Set y-position dynamics period to default value
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 0) { // lower green balance
      greenBalance = greenBalance - 0.1;
      if (greenBalance < 0.5) greenBalance = 0.5;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "greenBalance");
      gl.uniform1f(lc, greenBalance);
    } else if (keyMode == 2) {
      variableparams[18 * sel + 13] = 0.; // Set sigma-y dynamics period to default value
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) {
      variableparams[18 * sel + 16] = 1000.; // Set PA dynamics period to default value
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
  }
  if (e.key == 'y') {
    y_pressed = true;
    if (keyMode == 0) {
      blueBalance = blueBalance + 0.1;
      if (blueBalance > 1.) blueBalance = 1.;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "blueBalance");
      gl.uniform1f(lc, blueBalance);
    }
  }
  if (e.key == 'h') {
    if (keyMode == 1) {
      variableparams[18 * sel + 5] = 0.; // Set y-position dynamics phase to zero
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 0) {
      blueBalance = blueBalance - 0.1;
      if (blueBalance < 0.5) blueBalance = 0.5;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "blueBalance");
      gl.uniform1f(lc, blueBalance);
    } else if (keyMode == 2) {
      variableparams[18 * sel + 14] = 0.; // Set sigma-y dynamics phase to zero
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) {
      variableparams[18 * sel + 17] = 0.; // Set PA dynamics phase to zero
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
  }
  if (e.key == 'u') {
    radiansPerPixel = radiansPerPixel/1.5;
    var fov = height * radiansPerPixel * 180./Math.PI * 3600. * 1e6;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "rpp");
    gl.uniform1f(lc, radiansPerPixel);
  }
  if (e.key == 'i') {
    radiansPerPixel = radiansPerPixel*1.5;
    var fov = height * radiansPerPixel * 180./Math.PI * 3600. * 1e6;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "rpp");
    gl.uniform1f(lc, radiansPerPixel);
  }
  if (e.key == 'o') {
    lambdasPerPixel = lambdasPerPixel/1.5;
    var uvsize = height * lambdasPerPixel;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "lpp");
    gl.uniform1f(lc, lambdasPerPixel);
  }
  if (e.key == 'p') {
    lambdasPerPixel = lambdasPerPixel*1.5;
    var uvsize = height * lambdasPerPixel;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "lpp");
    gl.uniform1f(lc, lambdasPerPixel);
  }
  if (e.key == '0') {
    strengths[sel] = 0.;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "strengths");
    gl.uniform1fv(lc, strengths);
    requestAnimationFrame(render);
  }
  if (e.key == '[') {
    sel = sel - 1;
    if (sel < 0) sel = 9;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "sel");
    gl.uniform1i(lc, sel);
    requestAnimationFrame(render);
  }
  if (e.key == ']') {
    sel = sel + 1;
    if (sel > 9) sel = 0;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "sel");
    gl.uniform1i(lc, sel);
    requestAnimationFrame(render);
  }
  if (e.key == 'j') {
    keyMode = keyMode + 1;
    if (keyMode > 3) keyMode = 0;
    console.log("keyMode switched to ", keyMode);
    // Set HTML text to appropriate mode!
    if (keyMode == 0) {
      document.getElementById("modetext").innerHTML = "Current mode: component placement/sizing";
      document.getElementById("controls").innerHTML = "\
        <h2>Controls</h2>\
        <h3>single-press actions</h3>\
        <p>[ and ] keys: cycle through all 10 components to select the active source component (the selected component is indicated by a thin green bar at the very bottom of the sky image that jumps left or right when you switch selections  - look carefully). There are 10 source components in total that can all be modified.</p>\
        <p>q key: switch the type of the current source component between 2D Gaussian and circular disk. For the disk, only sigma-x is used to determine its size.</p>\
        <p>m key: center active component in middle of sky image.</p>\
        <p>n key: normalize strength of active component to 1.</p>\
        <p>b key: set sigma-x and sigma-y of active component to 50 pixels.</p>\
        <p>0 key: set strength of active component to zero.</p>\
        <p>u and i keys: change zoom level of sky image.</p>\
        <p>o and p keys: change zoom level of visibility map.</p>\
        <p>f,g,h keys: darken the r,g,b components of the visibility phase colour map.</p>\
        <p>r,t,y keys: brighten the r,g,b components of the visibility phase colour map.</p>\
        <p>k and l keys: change the size of the displayed window to make it fit your screen.</p>\
        \
        <h3>Press-and-hold actions</h3>\
        <p>Cursor keys: move active component across sky image.</p>\
        <p>w,a,s,d keys: change sigma-x (a and d) and sigma-y (s and w) of the current component.</p>\
        <p>comma and period keys: rotate the active component on the sky, if it is a Gaussian.</p>\
        <p>z and x keys: change strength of active component. Strength can be negative so that flux can be subtracted from other elements. When sky flux density becomes negative anywhere, this is indicated with a red colour.</p>\
        <p>c and v keys: change brightness scale of sky image.</p>\
        <p>minus and equals keys: change brightness scale of visibility map.</p>\
        ";
    }
    if (keyMode == 1) {
      document.getElementById("modetext").innerHTML = "Current mode: component position dynamics";
      document.getElementById("controls").innerHTML = "\
        <h2>Controls</h2>\
        <p>[ and ] keys: cycle through all 10 components to select the active source component (the selected component is indicated by a thin green bar at the very bottom of the sky image that jumps left or right when you switch selections  - look carefully). There are 10 source components in total that can all be modified.</p>\
        <p>q,a,z keys: increase, set to zero, or decrease the amplitude of the x-motion of the currently selected component.</p>\
        <p>w,s,x keys: increase, set to 1000, or decrease the period of the x-motion of the currently selected component.</p>\
        <p>e,d,c keys: increase, set to zero, or decrease the phase of the x-motion of the currently selected component.</p>\
        <p>r,f,v keys: increase, set to zero, or decrease the amplitude of the y-motion of the currently selected component.</p>\
        <p>t,g,b keys: increase, set to 1000, or decrease the period of the y-motion of the currently selected component.</p>\
        <p>y,h,n keys: increase, set to zero, or decrease the phase of the y-motion of the currently selected component.</p>\
        <p>m key: center active component in middle of sky image.</p>\
        <p>0 key: set strength of active component to zero.</p>\
        <p>u and i keys: change zoom level of sky image.</p>\
        <p>o and p keys: change zoom level of visibility map.</p>\
        <p>k and l keys: change the size of the displayed window to make it fit your screen.</p>\
        \
        <p>Cursor keys: move active component across sky image.</p>\
        <p>comma and period keys: rotate the active component on the sky, if it is a Gaussian.</p>\
        <p>minus and equals keys: change brightness scale of visibility map.</p>\
        ";
    }
    if (keyMode == 2) {
      document.getElementById("modetext").innerHTML = "Current mode: component size dynamics";
      document.getElementById("controls").innerHTML = "\
        <h2>Controls</h2>\
        <p>[ and ] keys: cycle through all 10 components to select the active source component (the selected component is indicated by a thin green bar at the very bottom of the sky image that jumps left or right when you switch selections  - look carefully). There are 10 source components in total that can all be modified.</p>\
        <p>q,a,z keys: increase, set to zero, or decrease the amplitude of the x-size variation of the currently selected component.</p>\
        <p>w,s,x keys: increase, set to 1000, or decrease the period of the x-size variation of the currently selected component.</p>\
        <p>e,d,c keys: increase, set to zero, or decrease the phase of the x-size variation of the currently selected component.</p>\
        <p>r,f,v keys: increase, set to zero, or decrease the amplitude of the y-size variation of the currently selected component.</p>\
        <p>t,g,b keys: increase, set to 1000, or decrease the period of the y-size variation of the currently selected component.</p>\
        <p>y,h,n keys: increase, set to zero, or decrease the phase of the y-size variation of the currently selected component.</p>\
        <p>m key: center active component in middle of sky image.</p>\
        <p>0 key: set strength of active component to zero.</p>\
        <p>u and i keys: change zoom level of sky image.</p>\
        <p>o and p keys: change zoom level of visibility map.</p>\
        <p>k and l keys: change the size of the displayed window to make it fit your screen.</p>\
        \
        <p>Cursor keys: move active component across sky image.</p>\
        <p>comma and period keys: rotate the active component on the sky, if it is a Gaussian.</p>\
        <p>minus and equals keys: change brightness scale of visibility map.</p>\
        ";
    }
    if (keyMode == 3) {
      document.getElementById("modetext").innerHTML = "Current mode: component brightness/angle dynamics";
      document.getElementById("controls").innerHTML = "\
        <h2>Controls</h2>\
        <p>[ and ] keys: cycle through all 10 components to select the active source component (the selected component is indicated by a thin green bar at the very bottom of the sky image that jumps left or right when you switch selections  - look carefully). There are 10 source components in total that can all be modified.</p>\
        <p>q,a,z keys: increase, set to zero, or decrease the amplitude of the brightness variation of the currently selected component.</p>\
        <p>w,s,x keys: increase, set to 1000, or decrease the period of the brightness variation of the currently selected component.</p>\
        <p>e,d,c keys: increase, set to zero, or decrease the phase of the brightness variation of the currently selected component.</p>\
        <p>r,f,v keys: increase, set to zero, or decrease the amplitude of the position angle variation of the currently selected component.</p>\
        <p>t,g,b keys: increase, set to 1000, or decrease the period of the position angle variation of the currently selected component.</p>\
        <p>y,h,n keys: increase, set to zero, or decrease the phase of the position angle variation of the currently selected component.</p>\
        <p>m key: center active component in middle of sky image.</p>\
        <p>0 key: set strength of active component to zero.</p>\
        <p>u and i keys: change zoom level of sky image.</p>\
        <p>o and p keys: change zoom level of visibility map.</p>\
        <p>k and l keys: change the size of the displayed window to make it fit your screen.</p>\
        \
        <p>Cursor keys: move active component across sky image.</p>\
        <p>comma and period keys: rotate the active component on the sky, if it is a Gaussian.</p>\
        <p>minus and equals keys: change brightness scale of visibility map.</p>\
        ";
    }
  }
  if (e.key == 'k') {
    // Resize the canvas element
    width = document.getElementById("canvas").width;
    height = document.getElementById("canvas").height;
    if (width > 100) {
      document.getElementById("canvas").width = width - 100;
      document.getElementById("canvas").height = height - 50;
      document.getElementById("textcanvas").width = width - 100;
      document.getElementById("textcanvas").height = height - 50;
      ctx = textcanvas.getContext("2d");
      gl.viewport(0, 0, width-100, height-50);
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "resolution");
      gl.uniform2f(lc, width-100, height-50);
      scale = width/2.;
      lc = gl.getUniformLocation(program, "scale");
      gl.uniform1f(lc, scale);
      radiansPerPixel = radiansPerPixel * width/(width-100);
      lambdasPerPixel = lambdasPerPixel * width/(width-100);
      lc = gl.getUniformLocation(program, "rpp");
      gl.uniform1f(lc, radiansPerPixel);
      lc = gl.getUniformLocation(program, "lpp");
      gl.uniform1f(lc, lambdasPerPixel);
      width  = document.getElementById("canvas").width;
      height = document.getElementById("canvas").height;
      requestAnimationFrame(render);
    }
    //console.log("Actual canvas width = ", document.getElementById("canvas").width);
    //console.log("drawingBufferWidth = ", gl.drawingBufferWidth);
    //console.log("window.innerWidth = ", window.innerWidth);
    //console.log("gl.canvas.clientWidth = ", gl.canvas.clientWidth);
    //console.log("gl.canvas.width = ", gl.canvas.width);
  }
  if (e.key == 'l') {
    // Resize the canvas element
    width = document.getElementById("canvas").width;
    height = document.getElementById("canvas").height;
    document.getElementById("canvas").width = width + 100;
    document.getElementById("canvas").height = height + 50;
    document.getElementById("textcanvas").width = width + 100;
    document.getElementById("textcanvas").height = height + 50;
    ctx = textcanvas.getContext("2d");
    gl.viewport(0, 0, width+100, height+50);
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "resolution");
    gl.uniform2f(lc, width+100, height+50);
    scale = width/2.;
    lc = gl.getUniformLocation(program, "scale");
    gl.uniform1f(lc, scale);
    radiansPerPixel = radiansPerPixel * width/(width+100);
    lambdasPerPixel = lambdasPerPixel * width/(width+100);
    lc = gl.getUniformLocation(program, "rpp");
    gl.uniform1f(lc, radiansPerPixel);
    lc = gl.getUniformLocation(program, "lpp");
    gl.uniform1f(lc, lambdasPerPixel);
    width  = document.getElementById("canvas").width;
    height = document.getElementById("canvas").height;
    requestAnimationFrame(render);
    //console.log("Actual canvas width = ", document.getElementById("canvas").width);
    //console.log("drawingBufferWidth = ", gl.drawingBufferWidth);
    //console.log("window.innerWidth = ", window.innerWidth);
    //console.log("gl.canvas.clientWidth = ", gl.canvas.clientWidth);
    //console.log("gl.canvas.width = ", gl.canvas.width);
  }
}

function checkInput() {
  //console.log("Checking input state!");
  if (left_pressed) {
    xes[sel] = xes[sel] - 1. * radiansPerPixel;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "xes");
    gl.uniform1fv(lc, xes);
    requestAnimationFrame(render);
  }
  if (right_pressed) {
    xes[sel] = xes[sel] + 1. * radiansPerPixel;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "xes");
    gl.uniform1fv(lc, xes);
    requestAnimationFrame(render);
  }
  if (up_pressed) {
    yes[sel] = yes[sel] + 1. * radiansPerPixel;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "yes");
    gl.uniform1fv(lc, yes);
    requestAnimationFrame(render);
  }
  if (down_pressed) {
    yes[sel] = yes[sel] - 1. * radiansPerPixel;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "yes");
    gl.uniform1fv(lc, yes);
    requestAnimationFrame(render);
  }
  if (q_pressed) {
    if (keyMode == 1) { // increase x-position dynamics amplitude
      variableparams[18 * sel + 0] = variableparams[18 * sel + 0] + radiansPerPixel;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) { // increase x-sigma dynamics amplitude
      variableparams[18 * sel + 9] = variableparams[18 * sel + 9] + radiansPerPixel;
      if (variableparams[18*sel+9] > (xsigmas[sel] - radiansPerPixel)) variableparams[18*sel+9] = xsigmas[sel] - radiansPerPixel;
      if (variableparams[18*sel+9] < 0.) variableparams[18*sel+9] = 0.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) { // increase brightness dynamics amplitude
      variableparams[18 * sel + 6] = variableparams[18 * sel + 6] + strengths[sel] * 0.01;
      if (variableparams[18*sel+6] > (strengths[sel] - 0.01)) variableparams[18*sel+6] = strengths[sel] - 0.01;
      if (variableparams[18*sel+6] < 0.) variableparams[18*sel+6] = 0.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
  }
  if (w_pressed) {
    if (keyMode == 0) { // increase y-sigma of component
      ysigmas[sel] = ysigmas[sel] + 1. * radiansPerPixel;
      if (ysigmas[sel] > windowSize * radiansPerPixel) ysigmas[sel] = windowSize * radiansPerPixel;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "ysigmas");
      gl.uniform1fv(lc, ysigmas);
    } else if (keyMode == 1) { // increase x-position dynamics period
      variableparams[18 * sel + 1] = variableparams[18 * sel + 1] + 100.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) { // increase x-sigma dynamics period
      variableparams[18 * sel + 10] = variableparams[18 * sel + 10] + 100.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) { // increase brightness dynamics period
      variableparams[18 * sel + 7] = variableparams[18 * sel + 7] + 100.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
    requestAnimationFrame(render);    
  }
  if (e_pressed) {
    if (keyMode == 1) { // increase x-position dynamics phase
      variableparams[18 * sel + 2] = variableparams[18 * sel + 2] + Math.PI/200.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) { // increase x-sigma dynamics phase
      variableparams[18 * sel + 11] = variableparams[18 * sel + 11] + Math.PI/200.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) { // increase brightness dynamics phase
      variableparams[18 * sel + 8] = variableparams[18 * sel + 8] + Math.PI/200.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
  }
  if (r_pressed) {
    if (keyMode == 1) { // change y position dynamics amplitude
      variableparams[18 * sel + 3] = variableparams[18 * sel + 3] + radiansPerPixel;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) { // Change y-sigma dynamics amplitude
      variableparams[18 * sel + 12] = variableparams[18 * sel + 12] + radiansPerPixel;
      if (variableparams[18*sel+12] > (ysigmas[sel] - radiansPerPixel)) variableparams[18*sel+12] = ysigmas[sel] - radiansPerPixel;
      if (variableparams[18*sel+12] < 0.) variableparams[18*sel+12] = 0.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) { // change PA dynamics amplitude
      variableparams[18 * sel + 15] = variableparams[18 * sel + 15] + Math.PI/200.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
  }
  if (t_pressed) {
    if (keyMode == 1) { // increase y-position dynamics period
      variableparams[18 * sel + 4] = variableparams[18 * sel + 4] + 100.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) { // increase y-sigma dynamics period
      variableparams[18 * sel + 13] = variableparams[18 * sel + 13] + 100.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) { // increase PA dynamics period
      variableparams[18 * sel + 16] = variableparams[18 * sel + 16] + 100.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
  }
  if (y_pressed) {
    if (keyMode == 1) { // increase y-position dynamics phase
      variableparams[18 * sel + 5] = variableparams[18 * sel + 5] + Math.PI/200.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) { // increase y-sigma dynamics phase
      variableparams[18 * sel + 14] = variableparams[18 * sel + 14] + Math.PI/200.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) { // increase PA dynamics phase
      variableparams[18 * sel + 17] = variableparams[18 * sel + 17] + Math.PI/200.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
  }
  if (s_pressed) {
    if (keyMode == 0) { // decrease y-sigma of component
      ysigmas[sel] = ysigmas[sel] - 1. * radiansPerPixel;
      if (ysigmas[sel] < 1. * radiansPerPixel) ysigmas[sel] = 1. * radiansPerPixel;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "ysigmas");
      gl.uniform1fv(lc, ysigmas);
      requestAnimationFrame(render);
    }
  }
  if (d_pressed) {
    if (keyMode == 0) { // increase x-sigma of component
      xsigmas[sel] = xsigmas[sel] + 1. * radiansPerPixel;
      if (xsigmas[sel] > windowSize * radiansPerPixel) xsigmas[sel] = windowSize * radiansPerPixel;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "xsigmas");
      gl.uniform1fv(lc, xsigmas);
      requestAnimationFrame(render);
    }
  }
  if (a_pressed) {
    if (keyMode == 0) { // decrease x-sigma of component
      xsigmas[sel] = xsigmas[sel] - 1. * radiansPerPixel;
      if (xsigmas[sel] < 1. * radiansPerPixel) xsigmas[sel] = 1. * radiansPerPixel;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "xsigmas");
      gl.uniform1fv(lc, xsigmas);
      requestAnimationFrame(render);
    }
  }
  if (comma_pressed) {
    thetas[sel] = thetas[sel] - 0.01 * Math.PI;
    if (thetas[sel] < 0.) thetas[sel] = thetas[sel] + Math.PI;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "thetas");
    gl.uniform1fv(lc, thetas);
    requestAnimationFrame(render); 
  }
  if (period_pressed) {
    thetas[sel] = thetas[sel] + 0.01 * Math.PI;
    if (thetas[sel] > Math.PI) thetas[sel] = thetas[sel] - Math.PI;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "thetas");
    gl.uniform1fv(lc, thetas);
    requestAnimationFrame(render); 
  }
  if (z_pressed) {
    if (keyMode == 0) { // decrease component strength
      strengths[sel] = strengths[sel] - 0.01;
      if (strengths[sel] < -5.) strengths[sel] = -5.;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "strengths");
      gl.uniform1fv(lc, strengths);
    } else if (keyMode == 1) { // decrease x-position dynamics amplitude
      variableparams[18 * sel + 0] = variableparams[18 * sel + 0] - radiansPerPixel;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) { // decrease x-sigma dynamics amplitude
      variableparams[18 * sel + 9] = variableparams[18 * sel + 9] - radiansPerPixel;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) { // decrease brightness dynamics amplitude
      variableparams[18 * sel + 6] = variableparams[18 * sel + 6] - strengths[sel] * 0.01;
      if (variableparams[18*sel+9] < 0.) variableparams[18*sel+9] = 0.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
    requestAnimationFrame(render);
  }
  if (x_pressed) {
    if (keyMode == 0) { // increase component strength
      strengths[sel] = strengths[sel] + 0.01;
      if (strengths[sel] > 5.) strengths[sel] = 5.;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "strengths");
      gl.uniform1fv(lc, strengths);
    } else if (keyMode == 1) { // decrease x-position dynamics period
      variableparams[18 * sel + 1] = variableparams[18 * sel + 1] - 100.;
      if (variableparams[18 * sel + 1] < 100.) variableparams[18 * sel + 1] = 100.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) { // decrease x-sigma dynamics period
      variableparams[18 * sel + 10] = variableparams[18 * sel + 10] - 100.;
      if (variableparams[18 * sel + 10] < 100.) variableparams[18 * sel + 10] = 100.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) { // decrease brightness dynamics period
      variableparams[18 * sel + 7] = variableparams[18 * sel + 7] - 100.;
      if (variableparams[18 * sel + 7] < 100.) variableparams[18 * sel + 7] = 100.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
    requestAnimationFrame(render);
  }
  if (c_pressed) {
    if (keyMode == 0) { // Lower image brightness
      imagestrength = imagestrength/1.1;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "imagestrength");
      gl.uniform1f(lc, imagestrength);
    } else if (keyMode == 1) { // decrease x-position dynamice phase
      variableparams[18 * sel + 2] = variableparams[18 * sel + 2] - Math.PI/200.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }  else if (keyMode == 2) { // decrease x-sigma dynamics phase
      variableparams[18 * sel + 11] = variableparams[18 * sel + 11] - Math.PI/200.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }  else if (keyMode == 3) { // decrease brightness dynamics phase
      variableparams[18 * sel + 8] = variableparams[18 * sel + 8] - Math.PI/200.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
    requestAnimationFrame(render);
  }
  if (v_pressed) {
    if (keyMode == 0) { // Increase image brightness
      imagestrength = imagestrength*1.1;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "imagestrength");
      gl.uniform1f(lc, imagestrength);
    } else if (keyMode == 1) { // decrease y-position dynamics amplitude
      variableparams[18 * sel + 3] = variableparams[18 * sel + 3] - radiansPerPixel;
      if (variableparams[18 * sel + 3] < 0.) variableparams[18 * sel + 3] = 0.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) { // decrease y-sigma dynamics amplitude
      variableparams[18 * sel + 12] = variableparams[18 * sel + 12] - radiansPerPixel;
      if (variableparams[18 * sel + 12] < 0.) variableparams[18 * sel + 12] = 0.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) { // decrease PA dynamics amplitude
      variableparams[18 * sel + 15] = variableparams[18 * sel + 15] - Math.PI/200.;
      if (variableparams[18 * sel + 15] < 0.) variableparams[18 * sel + 15] = 0.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
    requestAnimationFrame(render);
  }
  if (b_pressed) {
    if (keyMode == 1) { // decrease y-position dynamics period
      variableparams[18 * sel + 4] = variableparams[18 * sel + 4] - 100.;
      if (variableparams[18 * sel + 4] < 100.) variableparams[18 * sel + 4] = 100.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) { // decrease y-sigma dynamics period
      variableparams[18 * sel + 13] = variableparams[18 * sel + 13] - 100.;
      if (variableparams[18 * sel + 13] < 100.) variableparams[18 * sel + 13] = 100.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) { // decrease PA dynamics period
      variableparams[18 * sel + 16] = variableparams[18 * sel + 16] - 100.;
      if (variableparams[18 * sel + 16] < 100.) variableparams[18 * sel + 16] = 100.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
  }
  if (n_pressed) {
    if (keyMode == 1) { // decrease y-position dynamics phase
      variableparams[18 * sel + 5] = variableparams[18 * sel + 5] - Math.PI/200.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 2) { // decrease y-sigma dynamics phase
      variableparams[18 * sel + 14] = variableparams[18 * sel + 14] - Math.PI/200.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    } else if (keyMode == 3) { // decrease PA dynamics phase
      variableparams[18 * sel + 17] = variableparams[18 * sel + 17] - Math.PI/200.;
      lc = gl.getUniformLocation(program, "vps");
      gl.uniform1fv(lc, variableparams);
    }
  }

  if (minus_pressed) {
    fourierstrength = fourierstrength/1.1;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "fourierstrength");
    gl.uniform1f(lc, fourierstrength);
    requestAnimationFrame(render);
  }
  if (equals_pressed) {
    fourierstrength = fourierstrength*1.1;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "fourierstrength");
    gl.uniform1f(lc, fourierstrength);
    requestAnimationFrame(render);
  }
}

function keyup(e) {
  var keyCode = e.keyCode;
  if (keyCode == 37) left_pressed  = false;
  if (keyCode == 39) right_pressed = false;
  if (keyCode == 38) up_pressed    = false;
  if (keyCode == 40) down_pressed  = false;
  if (e.key == 'w') w_pressed      = false;
  if (e.key == 'a') a_pressed      = false;
  if (e.key == 's') s_pressed      = false;
  if (e.key == 'd') d_pressed      = false;
  if (e.key == 'z') z_pressed      = false;
  if (e.key == 'x') x_pressed      = false;
  if (e.key == 'c') c_pressed      = false;
  if (e.key == 'v') v_pressed      = false;
  if (e.key == ',') comma_pressed  = false;
  if (e.key == '.') period_pressed = false;
  if (e.key == '-') minus_pressed  = false;
  if (e.key == '=') equals_pressed = false;

  if (e.key == 'q') q_pressed      = false;
  if (e.key == 'e') e_pressed      = false;
  if (e.key == 'r') r_pressed      = false;
  if (e.key == 't') t_pressed      = false;
  if (e.key == 'y') y_pressed      = false;
  if (e.key == 'f') f_pressed      = false;
  if (e.key == 'g') g_pressed      = false;
  if (e.key == 'h') h_pressed      = false;
  if (e.key == 'b') b_pressed      = false;
  if (e.key == 'n') n_pressed      = false;
}

function render() {
  now = Date.now();
  setTimeout(function(){
  if (now - then > fpsInterval) {
    currentcounter = currentcounter + (now - then);
    then = now;
    checkInput();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = "10px Arial";
    ctx.fillStyle = "white";
    ctx.fillText("FOV: " + (radiansPerPixel * height * 180./Math.PI * 3600. * 1e6).toFixed(2).toString() + " muas", 10, height - 10);
    ctx.fillText("Max u/v: " + (lambdasPerPixel * height).toFixed(2).toString() + " wavelengths", height + 10, height - 10);
    ctx.fillText("Sky image", 10, 20);
    ctx.fillText("Visibility map", height + 10, 20);
    // Set time in shader to now
    lc = gl.getUniformLocation(program, "time");
    gl.uniform1f(lc, currentcounter);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  requestAnimationFrame(render);
  }, fpsInterval);
}

function main() {
  console.log("Starting!");
  canvas = document.getElementById('canvas');
  width = canvas.width;
  height = canvas.height;

  scale = width / 2.;

  fps = 90.;
  fpsInterval = 1000 / fps;

  currentcounter = 0.;

  // Add functions to deal with web form inputs (buttons, sliders, etc.)
  var slider1 = document.getElementById("slider1");
  var slider1output = document.getElementById("slider1output");
  slider1output.innerHTML = slider1.value; // Display the default slider value

  // Update the current slider value (each time you drag the slider handle)
  slider1.oninput = function() {
    slider1output.innerHTML = this.value;
    xes[0] = this.value * radiansPerPixel;
    lc = gl.getUniformLocation(program, "xes");
    gl.uniform1fv(lc, xes);
  }

  // Add key press event listener
  document.body.addEventListener("keydown", keydown, false);
  document.body.addEventListener("keyup", keyup, false);

  // Get A WebGL context
  gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }

  // look up the text canvas.
  textcanvas = document.getElementById("textcanvas");
  // make a 2D context for it
  ctx = textcanvas.getContext("2d");

  canvas.addEventListener("click", mouseclick, false);
  canvas.addEventListener("mousedown", mouseDown, false);
  canvas.addEventListener("mousemove", mouseMove, false);
  canvas.addEventListener("mouseup", mouseUp, false);

  function mouseclick(event) {
    var br = canvas.getBoundingClientRect();
    if (!mouse_dragging) {
      var x = event.clientX - br.left - height/2.;
      var y = event.clientY - br.top - height/2.;
      if (x < height) {
        // Use our mouseclick to reposition the active source component
        xes[sel] =   2. * x * radiansPerPixel; // Not quite sure why the scaling factor of 2 needs to be in there...but it works.
        yes[sel] =  -2. * y * radiansPerPixel;
        lc = gl.getUniformLocation(program, "xes");
        gl.uniform1fv(lc, xes);
        lc = gl.getUniformLocation(program, "yes");
        gl.uniform1fv(lc, yes);
      }

      console.log("Clicked!");
    }
    mouse_dragging = false;
  }

  function mouseDown(event) {
    var br = canvas.getBoundingClientRect();
    if (event.which === 1) {
      console.log("L Mouse down");
      l_mouse_is_down = true;
    } else if (event.which === 2) {
      console.log("M Mouse down");
    } else if (event.which === 3) {
      console.log("R Mouse down");
      r_mouse_is_down = true;
      // sort out location and PA value
      var mouse_x = event.clientX - br.left - height/2.;
      var mouse_y = event.clientY - br.top - height/2.;
      console.log("mouse x = ", mouse_x, ", mouse y = ", mouse_y);
      if (xsigmas[sel] >= ysigmas[sel]) {
        thetas[sel] = Math.atan2(mouse_y, mouse_x);
      } else {
        thetas[sel] = Math.atan2(mouse_y, mouse_x) + Math.PI/2.;
      }
      lc = gl.getUniformLocation(program, "thetas");
      gl.uniform1fv(lc, thetas);
    }
    mousestart_x = event.clientX - br.left - height/2.;
    mousestart_y = event.clientY - br.top - height/2.;
    mouselast_x = mousestart_x;
    mouselast_y = mousestart_y;
  }

  function mouseMove(event) {
    if (l_mouse_is_down) { // left-clicking and dragging
      mouse_dragging = true;
      var br = canvas.getBoundingClientRect();
      mouseend_x = event.clientX - br.left - height/2.;
      mouseend_y = event.clientY - br.top - height/2.;
      xsigmas[sel] = xsigmas[sel] + (mouseend_x - mouselast_x) * radiansPerPixel;
      ysigmas[sel] = ysigmas[sel] - (mouseend_y - mouselast_y) * radiansPerPixel;
      if (xsigmas[sel] < radiansPerPixel) xsigmas[sel] = radiansPerPixel;
      if (ysigmas[sel] < radiansPerPixel) ysigmas[sel] = radiansPerPixel;
      mouselast_x = mouseend_x;
      mouselast_y = mouseend_y;
      lc = gl.getUniformLocation(program, "xsigmas");
      gl.uniform1fv(lc, xsigmas);
      lc = gl.getUniformLocation(program, "ysigmas");
      gl.uniform1fv(lc, ysigmas);
      console.log("Mouse dragging");
    } else if (r_mouse_is_down) { // right-clicking and dragging
      // sort out location and PA value
      var br = canvas.getBoundingClientRect();
      var mouse_x = event.clientX - br.left - height/2.;
      var mouse_y = event.clientY - br.top - height/2.;
      console.log("mouse x = ", mouse_x, ", mouse y = ", mouse_y);
      if (xsigmas[sel] >= ysigmas[sel]) {
        thetas[sel] = Math.atan2(mouse_y, mouse_x);
      } else {
        thetas[sel] = Math.atan2(mouse_y, mouse_x) + Math.PI/2.;
      }
      lc = gl.getUniformLocation(program, "thetas");
      gl.uniform1fv(lc, thetas);
    } else {
      console.log("Mouse moving");
    }
  }

  function mouseUp(event) {
    console.log("Mouse up");
    var br = canvas.getBoundingClientRect();
    mouseend_x = event.clientX - br.left - height/2.;
    mouseend_y = event.clientY - br.top - height/2.;
    if (event.which === 1) l_mouse_is_down = false;
    if (event.which === 3) r_mouse_is_down = false;
    // Don't count it as dragging if the movement was small
    if (Math.abs(mouseend_x - mousestart_x) < 5. && Math.abs(mouseend_y - mousestart_y) < 5.) mouse_dragging = false;
  }

  // setup GLSL program
  var vertsource = document.getElementById("2d-vertex-shader").text;
  var fragsource = document.getElementById("2d-fragment-shader").text;

  program = InitializeShader(gl, vertsource, fragsource);

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(program, "a_position");
  var colorLocation = gl.getAttribLocation(program, "a_color");

  // Look up locations of other variables
  // Make sure that we are using the right program first.
  gl.useProgram(program);

  // Set start time for shader
  lc = gl.getUniformLocation(program, "time");
  gl.uniform1f(lc, currentcounter);

  lc = gl.getUniformLocation(program, "resolution");
  gl.uniform2f(lc, width, height);

  lc = gl.getUniformLocation(program, "sourcetypes");
  gl.uniform1iv(lc, sourcetypes);

  lc = gl.getUniformLocation(program, "xes");
  gl.uniform1fv(lc, xes);

  lc = gl.getUniformLocation(program, "yes");
  gl.uniform1fv(lc, yes);

  lc = gl.getUniformLocation(program, "xsigmas");
  gl.uniform1fv(lc, xsigmas);

  lc = gl.getUniformLocation(program, "ysigmas");
  gl.uniform1fv(lc, ysigmas);

  lc = gl.getUniformLocation(program, "thetas");
  gl.uniform1fv(lc, thetas);

  lc = gl.getUniformLocation(program, "vps");
  gl.uniform1fv(lc, variableparams);

  lc = gl.getUniformLocation(program, "strengths");
  gl.uniform1fv(lc, strengths);

  lc = gl.getUniformLocation(program, "scale");
  gl.uniform1f(lc, scale);

  lc = gl.getUniformLocation(program, "fourierstrength");
  gl.uniform1f(lc, fourierstrength);

  lc = gl.getUniformLocation(program, "imagestrength");
  gl.uniform1f(lc, imagestrength);

  lc = gl.getUniformLocation(program, "rpp");
  gl.uniform1f(lc, radiansPerPixel);

  lc = gl.getUniformLocation(program, "lpp");
  gl.uniform1f(lc, lambdasPerPixel);

  lc = gl.getUniformLocation(program, "sel");
  gl.uniform1i(lc, sel);

  lc = gl.getUniformLocation(program, "redBalance");
  gl.uniform1f(lc, redBalance);

  lc = gl.getUniformLocation(program, "greenBalance");
  gl.uniform1f(lc, greenBalance);

  lc = gl.getUniformLocation(program, "blueBalance");
  gl.uniform1f(lc, blueBalance);

  lc = gl.getUniformLocation(program, "uvpoints");
  gl.uniform1fv(lc, uvs);

  // Set our test vector array with some values
  lc = gl.getUniformLocation(program, "testvec");
  gl.uniform2fv(lc, [0., 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]);

  // lookup uniforms
  var matrixLocation = gl.getUniformLocation(program, "u_matrix");

  // Create a buffer for the positions.
  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // Set Geometry.
  setGeometry(gl);

  // Create a buffer for the colors.
  var colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  // Set the colors.
  setColors(gl);

  var translation = [0, 0];
  var angleInRadians = 0;
  var scale = [1, 1];

  drawScene();

  then = Date.now();
  requestAnimationFrame(render);

  // Draw the scene.
  function drawScene() {

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0.0, 0.5, 0.0, 1.0);

    // Clear the canvas.
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Tell it to use our program (pair of shaders)
    gl.useProgram(program);

    // Turn on the position attribute
    gl.enableVertexAttribArray(positionLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        positionLocation, size, type, normalize, stride, offset);

    // Turn on the color attribute
    gl.enableVertexAttribArray(colorLocation);

    // Bind the color buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);

    // Tell the color attribute how to get data out of colorBuffer (ARRAY_BUFFER)
    var size = 4;          // 4 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        colorLocation, size, type, normalize, stride, offset);

    /*
    // Compute the matrix
    var matrix = m3.projection(gl.canvas.clientWidth, gl.canvas.clientHeight);
    matrix = m3.translate(matrix, translation[0], translation[1]);
    matrix = m3.rotate(matrix, angleInRadians);
    matrix = m3.scale(matrix, scale[0], scale[1]);
    */

    var matrix = [
		1, 0, 0,
		0, 1, 0,
		0, 0, 1
	];

    // Set the matrix.
    gl.uniformMatrix3fv(matrixLocation, false, matrix);

    // Draw the geometry.
    var primitiveType = gl.TRIANGLES;
    var offset = 0;
    var count = 6;
    gl.drawArrays(primitiveType, offset, count);
  }
}

// Fill the buffer with the values that define a rectangle.
// Note, will put the values in whatever buffer is currently
// bound to the ARRAY_BUFFER bind point
function setGeometry(gl) {
  gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
          -1, -1,
          1, -1,
          -1, 1,
          1, -1,
          -1, 1,
          1, 1]),
      gl.STATIC_DRAW);
}

// Fill the buffer with colors for the 2 triangles
// that make the rectangle.
// Note, will put the values in whatever buffer is currently
// bound to the ARRAY_BUFFER bind point
function setColors(gl) {
  // Pick 2 random colors.
  var r1 = Math.random();
  var b1 = Math.random();
  var g1 = Math.random();
  var r2 = Math.random();
  var b2 = Math.random();
  var g2 = Math.random();

  gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(
        [ r1, b1, g1, 1,
          r1, b1, g1, 1,
          r1, b1, g1, 1,
          r2, b2, g2, 1,
          r2, b2, g2, 1,
          r2, b2, g2, 1]),
      gl.STATIC_DRAW);
}

main();
