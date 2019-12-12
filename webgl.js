"use strict";

/*
 * IMPLEMENTED:
 * - movement of components. Parameters needed per component:
 * - period, amplitude and absolute phase of horizontal motion
 * - period, amplitude and absolute phase of vertical motion
 * - period, amplitude and absolute phase of brightness variation
 * - period, amplitude and absolute phase of sigma-x
 * - period, amplitude and absolute phase of sigma-y
 * - period, amplitude and absolute phase of PA
 *
 * TO IMPLEMENT:
 * - Polarisation of components. Parameters needed per component:
 * - fractional polarisation degree (0..1)
 * - PA of component polarisation
 * - period, amplitude and absolute phase of polarisation degree (amp can be negative for flip)
 * - period, amplitude and absolute phase of polarisation PA
 *
 * Thoughts on reading out visibility values for specific uv-points.
 * Because one pixel in the Fourier view may be the closest pixel to multiple
 * uv-points in our measurement, we cannot have the normal shader take care of
 * generating measurement values as well. We need a separate shader that can do this.
 * This shader needs to take in a collection of uv-points together with the times
 * at which they should be read out (we are modeling actual observations, where
 * the source may be time-dependent).
 * Its output should be, for each of these uv-points, the corresponding visibility
 * measurement (complex) at the relevant time. To do this, we can identify one
 * uv-point+time with one pixel. We can therefore support datasets of up to the
 * order of 1 million measurement points - more than enough.
 * The uv-point, along with its time, will need to be coded as 3 floats (u, v, time).
 * If we prepare the uv-points as a texture, we will therefore need 3x4 = 12 bytes per
 * point. It may be worth checking out if there is an alternative way to supply arrays
 * of floats to the GPU.
 * Per pixel, we can pick the relevant uv-point in the list and iterate through all
 * source components to get their respective contribution to the measurement value.
 * When dealing with time-variable components, we can use the reference phase to quickly
 * sort out the relevant values at the requested time (also using the relevant periods).
 * Storing the complex-valued measurements will again require two floats, so 8 bytes per
 * measurement. If we can render to texture, we can then use a readpixels call from
 * javascript to get this information back for plotting.
 *
 * Relevant info:
 * Creating a texture in javascript: https://stackoverflow.com/questions/9046643/webgl-create-texture
 * Webgl2 texture data types: https://webgl2fundamentals.org/webgl/lessons/webgl-data-textures.html
 * More on creating textures: https://community.khronos.org/t/creating-textures-from-data/2630
 * Render to texture: http://www.opengl-tutorial.org/intermediate-tutorials/tutorial-14-render-to-texture/
 * More render to texture: https://webglfundamentals.org/webgl/lessons/webgl-render-to-texture.html
 * Reading pixels from a WebGL texture: https://stackoverflow.com/questions/13626606/read-pixels-from-a-webgl-texture
 *
 * Recipe for new shader:
 * - Has access to the same source component uniforms that are used for the existing shaders
 * - These uniforms need to be updated whenever the existing ones get updated
 * - Write function to stuff uv-points data into some type of float array, to be used as 'texture'. Use a texture type that can handle float32 per channel, this saves on conversions.
 * - Make sure that the new shader can read the float32-per-channel texture, test by displaying it
 * - Set up a texture to render to, which stores visibility values. We may need to use binary float-to-4-bytes tricks for this.
 * - Find a way to plot the resulting visibility/time data points. Perhaps by invoking another JS library.
 *
 * */

// Variable that holds the locations of variables in the shader for us
var lc;

// Keep track of whether the mouse button is down
var l_mouse_is_down = false;
var r_mouse_is_down = false;
var mousestart_x, mousestart_y, mouselast_x, mouselast_y, mouseend_x, mouseend_y, mousemoved_x, mousemoved_y, mouse_dragging;

var currentLoc = new Float32Array([20.,50.,90.,130.,170.,200.,220.,270.,290.,330.]);
var gl;
var program, calcprogram;
var fps, fpsInterval, now, then, currentcounter;

var rendering = true;
var paramsChanged = false;
var plotInFocus = true;

var keyMode = 0;

var canvas, textcanvas, ctx;
var width;
var height;
var scatterChart = null;
var uvdist = true;

var uvpointsTexture, visibilitiesTexture;
var calcFrameBuffer;

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
var fourierstrength = 1.;
var imagestrength = (Math.PI * 2500. * radiansPerPixel * radiansPerPixel);
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
  if (plotInFocus) {
    var keyCode = e.keyCode;
    //e.preventDefault();
    if (keyCode == 37) {
      left_pressed  = true;
      e.preventDefault();
    }
    if (keyCode == 39) {
      right_pressed = true;
      e.preventDefault();
    }
    if (keyCode == 38) {
      up_pressed    = true;
      e.preventDefault();
    }
    if (keyCode == 40) {
      down_pressed  = true;
      e.preventDefault();
    }
    if (e.key == 'w') w_pressed      = true;
    if (e.key == 'a') {
      a_pressed = true;
      if (keyMode == 1) {
        variableparams[18 * sel + 0] = 0.; // Set x amplitude to zero
        gl.useProgram(program);
        lc = gl.getUniformLocation(program, "vps");
        gl.uniform1fv(lc, variableparams);
      } else if (keyMode == 2) {
        variableparams[18 * sel + 9] = 0.; // Set sigma-x amplitude to zero
        gl.useProgram(program);
        lc = gl.getUniformLocation(program, "vps");
        gl.uniform1fv(lc, variableparams);
      } else if (keyMode == 3) {
        variableparams[18 * sel + 6] = 0.; // Set brightness amplitude to zero
        gl.useProgram(program);
        lc = gl.getUniformLocation(program, "vps");
        gl.uniform1fv(lc, variableparams);
      }
      paramsChanged = true;
    }
    if (e.key == 's') {
      s_pressed  = true;
      if (keyMode == 1) {
        variableparams[18 * sel + 1] = 1000.; // Set x period to default value
        gl.useProgram(program);
        lc = gl.getUniformLocation(program, "vps");
        gl.uniform1fv(lc, variableparams);
      } else if (keyMode == 2) {
        variableparams[18 * sel + 10] = 1000.; // Set sigma-x period to default value
        gl.useProgram(program);
        lc = gl.getUniformLocation(program, "vps");
        gl.uniform1fv(lc, variableparams);
      } else if (keyMode == 3) {
        variableparams[18 * sel + 7] = 1000.; // Set brightness period to default value
        gl.useProgram(program);
        lc = gl.getUniformLocation(program, "vps");
        gl.uniform1fv(lc, variableparams);
      }
      paramsChanged = true;
    }
    if (e.key == 'd') {
      d_pressed = true;
      if (keyMode == 1) {
        variableparams[18 * sel + 2] = 0.; // Set abs x phase to default value
        gl.useProgram(program);
        lc = gl.getUniformLocation(program, "vps");
        gl.uniform1fv(lc, variableparams);
      } else if (keyMode == 2) {
        variableparams[18 * sel + 11] = 0.; // Set sigma-x phase to default value
        gl.useProgram(program);
        lc = gl.getUniformLocation(program, "vps");
        gl.uniform1fv(lc, variableparams);
      } else if (keyMode == 3) {
        variableparams[18 * sel + 8] = 0.; // Set brightness phase to default value
        gl.useProgram(program);
        lc = gl.getUniformLocation(program, "vps");
        gl.uniform1fv(lc, variableparams);
      }
      paramsChanged = true;
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
        gl.useProgram(calcprogram);
        lc = gl.getUniformLocation(calcprogram, "sourcetypes");
        gl.uniform1iv(lc, sourcetypes);
        gl.useProgram(program);
        lc = gl.getUniformLocation(program, "sourcetypes");
        gl.uniform1iv(lc, sourcetypes);
      paramsChanged = true;
        //requestAnimationFrame(render);
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
      paramsChanged = true;
      //requestAnimationFrame(render);
    }
    if (e.key == 'n') {
      n_pressed = true;
      if (keyMode == 0) {
        strengths[sel] = 1.;
        gl.useProgram(program);
        lc = gl.getUniformLocation(program, "strengths");
        gl.uniform1fv(lc, strengths);
      paramsChanged = true;
        //requestAnimationFrame(render);
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
      paramsChanged = true;
        //requestAnimationFrame(render);
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
      paramsChanged = true;
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
      paramsChanged = true;
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
      paramsChanged = true;
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
      paramsChanged = true;
      //requestAnimationFrame(render);
    }
    if (e.key == '[') {
      sel = sel - 1;
      if (sel < 0) sel = 9;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "sel");
      gl.uniform1i(lc, sel);
      //requestAnimationFrame(render);
    }
    if (e.key == ']') {
      sel = sel + 1;
      if (sel > 9) sel = 0;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "sel");
      gl.uniform1i(lc, sel);
      //requestAnimationFrame(render);
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
        //requestAnimationFrame(render);
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
      //requestAnimationFrame(render);
      //console.log("Actual canvas width = ", document.getElementById("canvas").width);
      //console.log("drawingBufferWidth = ", gl.drawingBufferWidth);
      //console.log("window.innerWidth = ", window.innerWidth);
      //console.log("gl.canvas.clientWidth = ", gl.canvas.clientWidth);
      //console.log("gl.canvas.width = ", gl.canvas.width);
    }
    if (paramsChanged) {
      fill_table_from_js();
      paramsChanged = false;
    }
  } else {
    console.log("Keypress with canvas not in focus, ignored");
  }
}

function checkInput() {
  //console.log("Checking input state!");
  if (left_pressed) {
    xes[sel] = xes[sel] - 1. * radiansPerPixel;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "xes");
    gl.uniform1fv(lc, xes);
    paramsChanged = true;
    //requestAnimationFrame(render);
  }
  if (right_pressed) {
    xes[sel] = xes[sel] + 1. * radiansPerPixel;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "xes");
    gl.uniform1fv(lc, xes);
    paramsChanged = true;
    //requestAnimationFrame(render);
  }
  if (up_pressed) {
    yes[sel] = yes[sel] + 1. * radiansPerPixel;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "yes");
    gl.uniform1fv(lc, yes);
    paramsChanged = true;
    //requestAnimationFrame(render);
  }
  if (down_pressed) {
    yes[sel] = yes[sel] - 1. * radiansPerPixel;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "yes");
    gl.uniform1fv(lc, yes);
    paramsChanged = true;
    //requestAnimationFrame(render);
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
    paramsChanged = true;
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
    paramsChanged = true;
    //requestAnimationFrame(render);    
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
    paramsChanged = true;
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
    paramsChanged = true;
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
    paramsChanged = true;
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
    paramsChanged = true;
  }
  if (s_pressed) {
    if (keyMode == 0) { // decrease y-sigma of component
      ysigmas[sel] = ysigmas[sel] - 1. * radiansPerPixel;
      if (ysigmas[sel] < 1. * radiansPerPixel) ysigmas[sel] = 1. * radiansPerPixel;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "ysigmas");
      gl.uniform1fv(lc, ysigmas);
      //requestAnimationFrame(render);
    }
    paramsChanged = true;
  }
  if (d_pressed) {
    if (keyMode == 0) { // increase x-sigma of component
      xsigmas[sel] = xsigmas[sel] + 1. * radiansPerPixel;
      if (xsigmas[sel] > windowSize * radiansPerPixel) xsigmas[sel] = windowSize * radiansPerPixel;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "xsigmas");
      gl.uniform1fv(lc, xsigmas);
      //requestAnimationFrame(render);
    }
    paramsChanged = true;
  }
  if (a_pressed) {
    if (keyMode == 0) { // decrease x-sigma of component
      xsigmas[sel] = xsigmas[sel] - 1. * radiansPerPixel;
      if (xsigmas[sel] < 1. * radiansPerPixel) xsigmas[sel] = 1. * radiansPerPixel;
      gl.useProgram(program);
      lc = gl.getUniformLocation(program, "xsigmas");
      gl.uniform1fv(lc, xsigmas);
      //requestAnimationFrame(render);
    }
    paramsChanged = true;
  }
  if (comma_pressed) {
    thetas[sel] = thetas[sel] - 0.01 * Math.PI;
    if (thetas[sel] < 0.) thetas[sel] = thetas[sel] + Math.PI;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "thetas");
    gl.uniform1fv(lc, thetas);
    //requestAnimationFrame(render); 
    paramsChanged = true;
  }
  if (period_pressed) {
    thetas[sel] = thetas[sel] + 0.01 * Math.PI;
    if (thetas[sel] > Math.PI) thetas[sel] = thetas[sel] - Math.PI;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "thetas");
    gl.uniform1fv(lc, thetas);
    //requestAnimationFrame(render); 
    paramsChanged = true;
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
    paramsChanged = true;
    //requestAnimationFrame(render);
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
    paramsChanged = true;
    //requestAnimationFrame(render);
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
    paramsChanged = true;
    //requestAnimationFrame(render);
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
    paramsChanged = true;
    //requestAnimationFrame(render);
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
    paramsChanged = true;
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
    paramsChanged = true;
  }
  if (minus_pressed) {
    fourierstrength = fourierstrength/1.1;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "fourierstrength");
    gl.uniform1f(lc, fourierstrength);
    //requestAnimationFrame(render);
  }
  if (equals_pressed) {
    fourierstrength = fourierstrength*1.1;
    gl.useProgram(program);
    lc = gl.getUniformLocation(program, "fourierstrength");
    gl.uniform1f(lc, fourierstrength);
    //requestAnimationFrame(render);
  }
  if (paramsChanged) {
    fill_table_from_js();
    paramsChanged = false;
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
    if (rendering) {
      lc = gl.getUniformLocation(program, "time");
      gl.uniform1f(lc, currentcounter);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  requestAnimationFrame(render);
  }, fpsInterval);
}

function createDataTexture(gl, dataarray, sizex, sizey) {
    // Note that we expect dataarray to have float32 values in it, and be a product of powers of two in size.
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, sizex, sizey, 0, gl.RGBA, gl.FLOAT, dataarray);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}

function createOutputTexture(gl, sizex, sizey) {
    // Note that we expect dataarray to have float32 values in it, and be a product of powers of two in size.
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, sizex, sizey, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}

// Draw the scene.
function drawScene(glProgram) {

  gl.useProgram(glProgram);

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

  if (glProgram == calcprogram) {
    // look up where the texture coordinate data needs to go.
    var texcoordAttributeLocation = gl.getAttribLocation(glProgram, "a_texcoord");
    
    console.log("texcoordAttributeLocation: ", texcoordAttributeLocation);

    // Turn on the attribute
    gl.enableVertexAttribArray(texcoordAttributeLocation);

    // Upload texture coordinates to shader
    // create the texcoord buffer, make it the current ARRAY_BUFFER
    // and copy in the texcoord values
    var texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    setTexcoords(gl); 
     
    // Tell the attribute how to get data out of colorBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floating point values
    var normalize = false; // convert from 0-255 to 0.0-1.0
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next color
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(texcoordAttributeLocation, size, type, normalize, stride, offset);

    // Test area for uploading float32 textures to GPU
    var da = new Float32Array(4000);
    //var da = new Float32Array([31e3, 60.244,   15e-5, 200.,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                           1e-8,   3e30, 100.001, 4.45,
    //                          7.778,   0.04,   1e-23, 4e-1,
    //                            1.1,  1000.,     55.,   0.]);

    // ########### WARNING : THIS IS A DIRTY WORKAROUND!!! ######################
    // # We PRE_INITIALIZE THE TEXTURES TO BE 1000 PIXELS TALL BECAUSE CHANGING #
    // # THEIR SIZE LATER IS PROVING TO BE TROUBLESOME.

    uvpointsTexture = createDataTexture(gl, da, 1, 1000);
    visibilitiesTexture = createOutputTexture(gl, 1, 1000);

    // ##########################################################################
    // ##########################################################################
    // ##########################################################################

    var u_uvLocation = gl.getUniformLocation(glProgram, "uvpoints_info");
    var u_visibilityLocation = gl.getUniformLocation(glProgram, "output_visibilities");
 
    // set which texture units to render with.
    gl.uniform1i(u_uvLocation, 0);  // texture unit 0
    gl.uniform1i(u_visibilityLocation, 1);  // texture unit 1

    // Create and bind the framebuffer
    calcFrameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, calcFrameBuffer);
 
    // attach the texture as the first color attachment
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, visibilitiesTexture, 0);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(glProgram, "a_position");
  var colorLocation = gl.getAttribLocation(glProgram, "a_color");

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.clearColor(0.0, 0.5, 0.0, 1.0);

  // Clear the canvas.
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Tell it to use our program (pair of shaders)
  //gl.useProgram(program);

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

  var matrix = [
      	1, 0, 0,
      	0, 1, 0,
      	0, 0, 1
      ];

  // lookup uniforms
  var matrixLocation = gl.getUniformLocation(glProgram, "u_matrix");

  // Set the matrix.
  gl.uniformMatrix3fv(matrixLocation, false, matrix);

  // Draw the geometry.
  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = 6;
  gl.drawArrays(primitiveType, offset, count);
}

function setUniforms(glprog) {
// Look up locations of other variables
  // Make sure that we are using the right program first.
  gl.useProgram(glprog);

  lc = gl.getUniformLocation(glprog, "sourcetypes");
  gl.uniform1iv(lc, sourcetypes);

  lc = gl.getUniformLocation(glprog, "xes");
  gl.uniform1fv(lc, xes);

  lc = gl.getUniformLocation(glprog, "yes");
  gl.uniform1fv(lc, yes);

  lc = gl.getUniformLocation(glprog, "xsigmas");
  gl.uniform1fv(lc, xsigmas);

  lc = gl.getUniformLocation(glprog, "ysigmas");
  gl.uniform1fv(lc, ysigmas);

  lc = gl.getUniformLocation(glprog, "thetas");
  gl.uniform1fv(lc, thetas);

  lc = gl.getUniformLocation(glprog, "vps");
  gl.uniform1fv(lc, variableparams);

  lc = gl.getUniformLocation(glprog, "strengths");
  gl.uniform1fv(lc, strengths);
}

function fill_table_from_js() {
  // Fill the HTML table with source component parameters.
  // We run this function when we start the page,
  // and when we have updated source component properties using the mouse.
  for (var i = 1; i < 11; i++) {
    var elid = "c" + i + "-px";
    document.getElementById(elid).innerHTML = parseFloat(xes[i-1]).toPrecision(4);
    elid = "c" + i + "-py";
    document.getElementById(elid).innerHTML = parseFloat(yes[i-1]).toPrecision(4);
    elid = "c" + i + "-sx";
    document.getElementById(elid).innerHTML = parseFloat(xsigmas[i-1]).toPrecision(4);
    elid = "c" + i + "-sy";
    document.getElementById(elid).innerHTML = parseFloat(ysigmas[i-1]).toPrecision(4);
    elid = "c" + i + "-br";
    document.getElementById(elid).innerHTML = parseFloat(strengths[i-1]).toPrecision(4);
    elid = "c" + i + "-pa";
    document.getElementById(elid).innerHTML = parseFloat(thetas[i-1]).toPrecision(4);
  }
}

function fill_js_from_table() {
  // With this function, we update the source component variables in javascript
  // from the HTML table entries.
  // Note that we need to put some checks in place to guard against sigma <= 0 and the like.
  for (var i = 1; i < 11; i++) {
    var elid = "c" + i + "-px";
    var val = document.getElementById(elid).innerHTML;
    console.log(val);
    xes[i-1] = parseFloat(val);
    elid = "c" + i + "-py";
    val = document.getElementById(elid).innerHTML;
    console.log(val);
    yes[i-1] = parseFloat(val);
    elid = "c" + i + "-sx";
    val = document.getElementById(elid).innerHTML;
    console.log(val);
    xsigmas[i-1] = parseFloat(val);
    elid = "c" + i + "-sy";
    val = document.getElementById(elid).innerHTML;
    console.log(val);
    ysigmas[i-1] = parseFloat(val);
    elid = "c" + i + "-br";
    val = document.getElementById(elid).innerHTML;
    console.log(val);
    strengths[i-1] = parseFloat(val);
    elid = "c" + i + "-pa";
    val = document.getElementById(elid).innerHTML;
    console.log(val);
    thetas[i-1] = parseFloat(val);
  }
  setUniforms(calcprogram);
  setUniforms(program);
}

function initialize_visibilities_table() {
  // This function populates the (empty) table in the HTML page with 10 (u,v,time) points.
  // The idea is that the user can then summon the visibilities for these points at the
  // click of a button.
  // The same table thus holds u,v,time values as well as amp,phase values.
  // We will use the insertRow() and deleteRow() methods to take care of adding and removing points.
  // The relevant texture should only be generated once the user presses the 'calculate' button, not before.
  // This way, we save work and only determine the size of the texture we need at the last moment.
  var tab = document.getElementById('visibilitiestable');
  var row = tab.insertRow();
  var cell1 = row.insertCell(0);
  var cell2 = row.insertCell(1);
  var cell3 = row.insertCell(2);
  var cell4 = row.insertCell(3);
  var cell5 = row.insertCell(4);
  cell1.innerHTML = "U coordinate";
  cell2.innerHTML = "V coordinate";
  cell3.innerHTML = "Time";
  cell4.innerHTML = "Amplitude";
  cell5.innerHTML = "Phase";
  for (var q = 0; q < 10; q++) {
    row = tab.insertRow();
    cell1 = row.insertCell(0);
    cell2 = row.insertCell(1);
    cell3 = row.insertCell(2);
    cell4 = row.insertCell(3);
    cell5 = row.insertCell(4);
    if (q == 0) {
      var cell6 = row.insertCell(5);
      cell6.rowSpan = 10;
    }
    cell1.innerHTML = q * 1e9;
    cell2.innerHTML = 0;
    cell3.innerHTML = 0;
    cell4.innerHTML = "";
    cell5.innerHTML = "";
  }
}

function upload_uvs_from_table() {
  // To do here:
  // Prepare list of all uv-points by first parsing table size, then preparing a suitable float32array holding all uv-values.
  var tab = document.getElementById("visibilitiestable");
  var rows = tab.rows.length - 1; // remove the header row
  // Make a Float32 array of size 4x(next smallest power of 2).
  //var pow2size = Math.pow(2, Math.ceil(Math.log(rows) / Math.log(2)));
  //console.log("Table rows: " + rows.toString() + ". Next power of 2: " + pow2size.toString());
  //var texArray = new Float32Array(4 * pow2size);
  var texArray = new Float32Array(4 * rows);
  for (var j = 0; j < rows; j++) {
    texArray[4 * j + 0] = parseFloat(tab.rows[j+1].cells[1].innerHTML); // u value
    texArray[4 * j + 1] = parseFloat(tab.rows[j+1].cells[2].innerHTML); // v value
    texArray[4 * j + 2] = parseFloat(tab.rows[j+1].cells[3].innerHTML); // time value
    console.log(texArray[4*j+0], texArray[4*j+1], texArray[4*j+2]);
  }
  // Upload this array as a texture to the calc shader and have it calculate the corresponding visibilities.
  gl.useProgram(calcprogram);
  calcVisibilities(gl, texArray, 1, rows);
  // Get the visibilities back from the calc shader and insert them into the table.
  console.log("Fetching uv-points from table...");
}

function remove_uvpoint_from_table(elem) {
  //var element = document.getElementById("element-id");
  //element.parentNode.removeChild(element);
  //alert(elem.parentNode.id);
  var row = elem.parentNode.parentNode;
  elem.parentNode.parentNode.parentNode.removeChild(row);
  var tab = document.getElementById("visibilitiestable");
  var rows = tab.rows.length - 1;
  for (var j = 0; j < rows; j++) {
    tab.rows[j+1].cells[0].innerHTML = (j+1).toString();
    //tab.rows[j+1].cells[0].innerHTML = "Fred";
  }
}

function add_row_to_visibilitiestable() {
  // To do here:
  // Go through uvpoints table to check its length.
  // Add row with the correct uvpoint index in the first cell.
  var tab = document.getElementById('visibilitiestable');
  var rows = tab.rows.length;
  var row = tab.insertRow();
  var cell1 = row.insertCell(0);
  var cell2 = row.insertCell(1);
  var cell3 = row.insertCell(2);
  var cell4 = row.insertCell(3);
  var cell5 = row.insertCell(4);
  var cell6 = row.insertCell(5);
  var cell7 = row.insertCell(6);
  cell2.setAttribute('contentEditable', 'true');
  cell3.setAttribute('contentEditable', 'true');
  cell4.setAttribute('contentEditable', 'true');
  cell1.innerHTML = rows;
  cell2.innerHTML = "0.";
  cell3.innerHTML = "0.";
  cell4.innerHTML = "0.";
  cell7.innerHTML = "<button class=\"button\" onclick=\"remove_uvpoint_from_table(this)\" >Remove</button>";
}

function toggle_uvdist_time() {
  uvdist = !uvdist;
  upload_uvs_from_table();
}

function calcVisibilities(gl, texArray, xlen, ylen) {
  console.log("Switching to calc shader...");
  gl.useProgram(calcprogram);
  // Update all uniforms for the compute shader

  // Update all variability params
  lc = gl.getUniformLocation(calcprogram, "vps");
  gl.uniform1fv(lc, variableparams);

  // Update other shader uniforms
  setUniforms(calcprogram);

  lc = gl.getUniformLocation(calcprogram, "resolution");
  gl.uniform2f(lc, xlen, ylen);

  createDataTexture(gl, texArray, xlen, ylen);
  createOutputTexture(gl, xlen, ylen);

  var u_uvLocation = gl.getUniformLocation(calcprogram, "uvpoints_info");
  var u_visibilityLocation = gl.getUniformLocation(calcprogram, "output_visibilities");
 
  // set which texture units to render with.
  gl.uniform1i(u_uvLocation, 0);  // texture unit 0
  gl.uniform1i(u_visibilityLocation, 1);  // texture unit 1

  // bind our calc framebuffer to rendering output so we render to texture (don't forget to use gl.viewport!)
  console.log("Switching to framebuffer...");

  calcFrameBuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, calcFrameBuffer);
  gl.viewport(0, 0, xlen, ylen);
 
  // attach the texture as the first color attachment
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, visibilitiesTexture, 0);
  // - Make sure that at least one render pass is performed: use gl.Clear, gl.drawArrays/gl.drawElements
  console.log("Rendering to texture...");
  gl.clearColor(0, 0, 1, 1);   // clear to blue
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // - Retrieve output texture from GPU
  var ph = new Float32Array(4 * xlen * ylen);
  gl.readPixels(0, 0, xlen, ylen, gl.RGBA, gl.FLOAT, ph, 0);
  console.log("Retrieved texture data:");
  console.log(ph);
  // - Parse output texture into visibility measurements
  // Every 4 floats in our Float32Array are one visibility measurement.
  // Go through our table and populate the amplitude and phase for every one.

  var tab = document.getElementById("visibilitiestable");
  var rows = tab.rows.length - 1; // remove the header row
  var ampchartdata = [];
  var phasechartdata = [];
  for (var j = 0; j < rows; j++) {
    tab.rows[j+1].cells[4].innerHTML = ph[4 * j + 0].toPrecision(4); // amplitude
    tab.rows[j+1].cells[5].innerHTML = ph[4 * j + 1].toPrecision(4); // phase
    var uval = parseFloat(tab.rows[j+1].cells[1].innerHTML);
    var vval = parseFloat(tab.rows[j+1].cells[2].innerHTML);
    var tval = parseFloat(tab.rows[j+1].cells[3].innerHTML);
    var aval = parseFloat(tab.rows[j+1].cells[4].innerHTML);
    var pval = parseFloat(tab.rows[j+1].cells[5].innerHTML);
    if (uvdist) {
      ampchartdata.push({x: Math.sqrt(uval * uval + vval * vval),y: aval});
      phasechartdata.push({x: Math.sqrt(uval * uval + vval * vval),y: pval});
    } else {
      ampchartdata.push({x: tval, y: aval});
      phasechartdata.push({x: tval, y: pval});
    }
  }

  // - Plot visibility measurements in separate canvas
  var ctx = document.getElementById('viscanvas');
  if (scatterChart != null) scatterChart.destroy();
  scatterChart = new Chart(ctx, {
    type: 'scatter',
    data: {
        datasets: [{
            label: 'Visibility amplitude',
            data: ampchartdata,
	    backgroundColor: 'rgba(255, 0, 0, 1.0)',
	    yAxisID: 'amp-axis'
	},{
            label: 'Visibility phase',
            data: phasechartdata,
	    backgroundColor: 'rgba(0, 0, 255, 1.0)',
	    yAxisID: 'phase-axis'
	}]
    },
    options: {
	responsive: false,
	stacked: false,
        scales: {
            xAxes: [{
                type: 'linear',
                position: 'bottom',
		scaleLabel: {
		    display: true,
		    labelString: "UV distance (lambdas)"
		}
            }],
            yAxes: [{
                type: 'linear',
		scaleLabel: {
		    display: true,
		    labelString: "Amplitude (Jy)"
		},
		id: 'amp-axis',
		position: 'left'
            },{
                type: 'linear',
		scaleLabel: {
		    display: true,
		    labelString: "Phase (rad)"
		},
		id: 'phase-axis',
		position: 'right',
		gridLines: {
		    drawOnChartArea: false
		}
	    }]
        }
    }
  });
  scatterChart.resize(1200,600);

  console.log("Switching back to screenbuffer...");
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  console.log("Switching back to draw shader...");
  gl.useProgram(program);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}

function interpolate_uvpoints() {
  var tab = document.getElementById("visibilitiestable");
  console.log(tab);
  var rows = tab.rows.length - 1; // remove the header row
  var startu = parseFloat(tab.rows[1].cells[1].innerHTML);
  var startv = parseFloat(tab.rows[1].cells[2].innerHTML);
  var startt = parseFloat(tab.rows[1].cells[3].innerHTML);
  console.log("start nums", startu, startv, startt);
  var endu = parseFloat(tab.rows[rows].cells[1].innerHTML);
  var endv = parseFloat(tab.rows[rows].cells[2].innerHTML);
  var endt = parseFloat(tab.rows[rows].cells[3].innerHTML);
  console.log("end nums", endu, endv, endt);
  for (var j = 2; j < rows; j++) {
    tab.rows[j].cells[1].innerHTML = (startu + (endu - startu) * (j-1)/(rows-1)).toPrecision(4);
    tab.rows[j].cells[2].innerHTML = (startv + (endv - startv) * (j-1)/(rows-1)).toPrecision(4);
    tab.rows[j].cells[3].innerHTML = (startt + (endt - startt) * (j-1)/(rows-1)).toPrecision(4);
  }
}

function main() {
  // Populate our HTML table with source component parameter values
  fill_table_from_js();

  // Hide our tables by default!
  var coll = document.getElementsByClassName("collapsible");
  
  for (var i = 0; i < coll.length; i++) {
    coll[i].addEventListener("click", function() {
      this.classList.toggle("active");
      var content = this.nextElementSibling;
      if (content.style.display === "inline") {
        content.style.display = "none";
      } else {
        content.style.display = "inline";
      }
    });
  }
  //initialize_visibilities_table();
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

  // Get A WebGL context. We need webgl2!
  gl = canvas.getContext("webgl2");
  if (!gl) {
    console.log("Webgl2 is not supported for this OS/browser combination! :(");
    return;
  }

  // This extension is needed to read float32 textures back from the GPU with gl.readPixels().
  const ext = gl.getExtension("EXT_color_buffer_float");
  if (!ext) {
    console.log("need EXT_color_buffer_float extension :(");
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

  document.body.addEventListener("mousedown", mouseDownBody, false);

  function mouseclick(event) {
    var br = canvas.getBoundingClientRect();
    if (!mouse_dragging) {
      var x = event.clientX - br.left - height/2.;
      var y = event.clientY - br.top - height/2.;
      if (x < height/2.) {
        // Use our mouseclick to reposition the active source component
        xes[sel] =   2. * x * radiansPerPixel; // Not quite sure why the scaling factor of 2 needs to be in there...but it works.
        yes[sel] =  -2. * y * radiansPerPixel;
        lc = gl.getUniformLocation(program, "xes");
        gl.uniform1fv(lc, xes);
        lc = gl.getUniformLocation(program, "yes");
        gl.uniform1fv(lc, yes);
        fill_table_from_js();
      }

      console.log("Clicked!");
    }
    mouse_dragging = false;
  }

  function mouseDownBody(event) {
    console.log("Mouse down in HTML body!");
    console.log(event.target.id);
    if (event.target.id != "canvas") {
      plotInFocus = false;
    }
  }

  function mouseDown(event) {
    plotInFocus = true;
    var br = canvas.getBoundingClientRect();
    var mouse_x = event.clientX - br.left - height/2.;
    var mouse_y = event.clientY - br.top - height/2.;
    if (mouse_x < height/2.) {
      if (event.which === 1) {
        console.log("L Mouse down");
        l_mouse_is_down = true;
      } else if (event.which === 2) {
        console.log("M Mouse down");
      } else if (event.which === 3) {
        console.log("R Mouse down");
        r_mouse_is_down = true;
        // sort out location and PA value
        console.log("mouse x = ", mouse_x, ", mouse y = ", mouse_y);
        if (xsigmas[sel] >= ysigmas[sel]) {
          thetas[sel] = Math.atan2(mouse_y, mouse_x);
        } else {
          thetas[sel] = Math.atan2(mouse_y, mouse_x) + Math.PI/2.;
        }
        lc = gl.getUniformLocation(program, "thetas");
        gl.uniform1fv(lc, thetas);
        fill_table_from_js();
      }
      mousestart_x = event.clientX - br.left - height/2.;
      mousestart_y = event.clientY - br.top - height/2.;
      mouselast_x = mousestart_x;
      mouselast_y = mousestart_y;
    }
  }

  function mouseMove(event) {
    if (l_mouse_is_down) { // left-clicking and dragging
      mouse_dragging = true;
      var br = canvas.getBoundingClientRect();
      mouseend_x = event.clientX - br.left - height/2.;
      mouseend_y = event.clientY - br.top - height/2.;
      console.log("x delta: ", mouseend_x - mouselast_x);
      console.log("y delta: ", mouseend_y - mouselast_y);
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
      fill_table_from_js();
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
      fill_table_from_js();
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

  //// Install a listener that tracks edits to the table for source components
  //// Select the node that will be observed for mutations
  //const targetNode = document.getElementById('componenttable');

  //// Options for the observer (which mutations to observe)
  //const config = { attributes: true, childList: false, subtree: true, characterData: true };

  //// Callback function to execute when mutations are observed
  //const callback = function(mutationsList, observer) {
  //  // Use traditional 'for loops' for IE 11
  //  for(let mutation of mutationsList) {
  //      console.log(mutation);
  //      if (mutation.type === 'attributes') {
  //          console.log('The ' + mutation.attributeName + ' attribute was modified.');
  //      }
  //      if (mutation.type === 'characterData') {
  //          console.log('The character data in ' + mutation.target.parentNode.id + ' was modified to ' + mutation.target.data);
  //      }
  //  }
  //};

  //// Create an observer instance linked to the callback function
  //const observer = new MutationObserver(callback);

  //// Start observing the target node for configured mutations
  //observer.observe(targetNode, config);

  //// Different method of listenign for input on HTML page:
  //document.getElementById("c1-px").addEventListener("input", function() {
  //  console.log("input event fired!");
  //}, false);

  // setup GLSL program
  var vertsource = document.getElementById("2d-vertex-shader").text;
  var fragsource = document.getElementById("2d-fragment-shader").text;
  var vertcalcsource = document.getElementById("2d-vertex-calc").text;
  var viscalcsource = document.getElementById("2d-vis-calc").text;

  program = InitializeShader(gl, vertsource, fragsource);
  calcprogram = InitializeShader(gl, vertcalcsource, viscalcsource);

  // Set the common uniforms that both shaders share
  setUniforms(program);
  setUniforms(calcprogram);

  // From here on, set uniforms that are only used by the draw shader
  gl.useProgram(program);

  lc = gl.getUniformLocation(program, "time");
  gl.uniform1f(lc, currentcounter);

  lc = gl.getUniformLocation(program, "resolution");
  gl.uniform2f(lc, width, height);

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

  // Set resolution for calc texture separately!
  gl.useProgram(calcprogram);
  lc = gl.getUniformLocation(calcprogram, "resolution");
  gl.uniform2f(lc, 4, 4);

  var translation = [0, 0];
  var angleInRadians = 0;
  var scale = [1, 1];

  console.log("Drawing scene for render");
  drawScene(program);
  console.log("Drawing scene for calc");
  drawScene(calcprogram);
  gl.useProgram(program);

  then = Date.now();
  requestAnimationFrame(render);
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

// Fill the buffer with texture coordinates for the F.
function setTexcoords(gl) {
  gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        // left column front
        -1, -1,
        -1, 1,
        1, -1,
        -1, 1,
        1, -1,
        1, 1,
       ]),
       gl.STATIC_DRAW);
}

main();
