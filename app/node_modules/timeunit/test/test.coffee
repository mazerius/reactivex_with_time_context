timeunit = require '../src/timeunit'
assert = require 'assert'

describe "timeunitjs", ->
    it "should do simple conversions", ->
        assert.equal 5000, timeunit.seconds.toMillis 5
        assert.equal 5, timeunit.milliseconds.toSeconds 5000

    it "should convert with convert() correctly", ->
        assert.equal 5000, timeunit.milliseconds.convert 5, timeunit.seconds
        assert.equal 5, timeunit.seconds.convert 5000, timeunit.milliseconds

    it "should sleep for 1 second", (done) ->
        start = Date.now()
        timeunit.seconds.sleep 1, ->
            end = Date.now()
            slept = timeunit.milliseconds.toSeconds end - start
            assert slept > 0.8, "Slept for #{slept} seconds"
            assert slept < 1.2, "Slept for #{slept} seconds"
            done()

    it "should do something 10 times in one second", (done) ->
        start = Date.now()
        count = 0
        intervalId = timeunit.milliseconds.interval 100, ->
            count++
        timeunit.seconds.sleep 1, ->
            timeunit.clearInterval intervalId
            assert count > 8, "Happened #{count} times"
            assert count < 12, "Happened #{count} times"
            done()

    it "should not do something if ther interval is cleared", (done) ->
        start = Date.now()
        count = 0
        intervalId = timeunit.milliseconds.interval 100, ->
            count++
        timeunit.clearInterval intervalId
        timeunit.seconds.sleep 1, ->
            assert count is 0, "Happened #{count} times"
            done()

    it "should throw an exception for an invalid interval", ->
        err = null
        try
            intervalId = timeunit.seconds.interval -1, ->
                console.log "foo"
            timeunit.clearInterval intervalId
        catch e
            err = e
        assert err?, "Expected a failure"


