# Port of [Doug Lea](http://g.oswego.edu/)'s public domain Java TimeUnit class to JavaScript.
#
# Based on the [backport-util-concurrent](http://backport-jsr166.sourceforge.net/) version.
# Ported by Jason Walton, released under the
# [public domain](http://creativecommons.org/licenses/publicdomain).
#

# This is based on https://github.com/umdjs/umd/blob/master/returnExports.js
umd = (root, factory) ->
    if typeof define is 'function' and define.amd
        # AMD. Register as an anonymous module.
        define([], factory)
    else if typeof exports is 'object' and typeof module is 'object'
        # Node. Does not work with strict CommonJS, but
        # only CommonJS-like enviroments that support module.exports,
        # like Node.
        module.exports = factory();
    else
        # Browser globals (root is window)
        root.timeunit = factory(root.b);

umd this, ->
    exports = {}

    # Create new objects.  `proto` is the parent to inherit from, `newObj` is the new
    # object definition.
    object = (proto, newObj) ->
        if Object.create?
            answer = Object.create proto
        else
            F = ->
            F.prototype = proto
            answer = new F()

        # Add properties from newObj.
        for name, prop of newObj
            answer[name] = prop

        return answer

    # Handy constants for conversion methods
    C0 = 1
    C1 = C0 * 1000
    C2 = C1 * 1000
    C3 = C2 * 1000
    C4 = C3 * 60
    C5 = C4 * 60
    C6 = C5 * 24
    C = [C0, C1, C2, C3, C4, C5, C6]

    # Base from which all our constants inherit.
    baseTimeUnit = {
        # Equivalent to `timeunit.nanoseconds.convert(duration, this)`.
        toNanos:   (d) -> d/(C[0]/C[@index])

        # Equivalent to `timeunit.microseconds.convert(duration, this)`.
        toMicros:  (d) -> d/(C[1]/C[@index])

        # Equivalent to `timeunit.milliseconds.convert(duration, this)`.
        toMillis:  (d) -> d/(C[2]/C[@index])

        # Equivalent to `timeunit.seconds.convert(duration, this)`.
        toSeconds: (d) -> d/(C[3]/C[@index])

        # Equivalent to `timeunit.minutes.convert(duration, this)`.
        toMinutes: (d) -> d/(C[4]/C[@index])

        # Equivalent to `timeunit.hours.convert(duration, this)`.
        toHours:   (d) -> d/(C[5]/C[@index])

        # Equivalent to `timeunit.days.convert(duration, this)`.
        toDays:    (d) -> d/(C[6]/C[@index])

        # Convert the given time duration unit to this unit.  Unlike the Java version,
        # conversions do not lose prescision, so converting 999 milliseconds to seconds
        # would result in 0.999.
        #
        # Parameters:
        # * `sourceDuration` the time duration in the given `sourceUnit`.
        # * `sourceUnit` the unit of the `sourceDuration` argument.
        convert: (sourceDuration, sourceUnit) -> sourceDuration/(C[@index]/C[sourceUnit.index])

        # Call `fn` after the specified timeout.
        #
        # Returns a timer ID which can be passed to `timeunit.clearTimeout()` to cancel the timer.
        sleep: (timeout, fn) ->
            if (timeout < 0) then timeout = 0
            ms = @toMillis timeout
            return setTimeout fn, ms

        # Call `fn` repeatedly, delaying by `interval` between each execution.
        #
        # Returns an intervalID which can be passed to `timeunit.clearInterval()` to stop the
        # interval.
        interval: (interval, fn) ->
            if (interval < 0) then throw new Error("Invalid interval: #{interval} #{@name}")
            ms = @toMillis interval
            return setInterval fn, ms
    }

    exports.nanoseconds = object baseTimeUnit, {
        index: 0
        name: "nanoseconds"
    }

    exports.microseconds = object baseTimeUnit, {
        index: 1
        name: "microseconds"
    }

    exports.milliseconds = object baseTimeUnit, {
        index: 2
        name: "milliseconds"
    }

    exports.seconds = object baseTimeUnit, {
        index: 3
        name: "seconds"
    }

    exports.minutes = object baseTimeUnit, {
        index: 4
        name: "minutes"
    }

    exports.hours = object baseTimeUnit, {
        index: 5
        name: "hours"
    }

    exports.days = object baseTimeUnit, {
        index: 6
        name: "days"
    }

    exports.clearTimeout = clearTimeout
    exports.clearInterval = clearInterval

    return exports
