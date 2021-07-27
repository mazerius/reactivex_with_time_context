TimeUnit js
======================

TimeUnit is a port of [Doug Lea](http://g.oswego.edu/)'s public domain TimeUnit Java class
to JavaScript.  It was ported from the
[backport-util-concurrent](http://backport-jsr166.sourceforge.net/) version.
This class is the basis for `java.util.concurrent.TimeUnit` from JavaSE.

Ported by Jason Walton, released under the
[public domain](http://creativecommons.org/licenses/publicdomain).

[![NPM](https://nodei.co/npm/timeunit.png?downloads=true&stars=true)](https://nodei.co/npm/timeunit/)

About
=====

A `timeunit` represents time durations at a given unit of
granularity and provides utility methods to convert across units,
and to perform delay operations in these units.  A
`timeunit` does not maintain time information, but only
helps organize and use time representations that may be maintained
separately across various contexts.

A `timeunit` is mainly used to inform time-based methods
how a given timing parameter should be interpreted.  Time units may be passed as constants
to other methods:

    wait(50, timeunit.seconds);

Or can be used to perform conversions, such as converting 5 seconds into 5000 milliseconds:

    timeunit.seconds.toMilliseconds(5); // Returns 5000
    timeunit.milliseconds.convert(5, timeunit.seconds); // Returns 5000

`timeunit` also define the very handy `sleep()` function, which schedules a function for future
execution using `setTimeout()`:

    timeunit.seconds.sleep(5, function() {
        console.log("Hello after 5 seconds!");
    });

Perhaps even more useful in CoffeeScript, where it is a little easier to use that setTimeout, since
it follows the "callback at the end" idiom used by most node.js code:

    timeunit.seconds.sleep 5, () ->
        console.log "Hello world"

As opposed to the somewhat less pretty:

    setTimeout (()->
        console.log "Hello world"
    ), 5000

A nanosecond is defined as one thousandth of a microsecond, a microsecond as one thousandth of a
millisecond, a millisecond as one thousandth of a second, a minute as sixty seconds, an hour as
sixty minutes, and a day as twenty four hours.

Compatibilty
============

`timeunit` uses [UMD](https://github.com/umdjs/umd) for it's module definition, so should work in
[node.js](http://nodejs.org/), in the browser (via the `timeunit` global), via
[AMD/Require.js](http://requirejs.org/) and via [browersify](http://browserify.org/).

### node.js

Install in node.js with:

    npm install timeunit

### bower

Install with:

    bower install timeunit
