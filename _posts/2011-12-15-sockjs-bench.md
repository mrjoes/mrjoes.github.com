---
layout: post
title: SockJS benchmark
abstract: Benchmarking the sockjs-tornado and sockjs-node server implementations.
---

<script src="http://yandex.st/jquery/1.7.1/jquery.min.js"> </script>
<script src="http://yandex.st/jquery/flot/0.7/jquery.flot.min.js"> </script>
<script src="/shared/js/jquery.flot.crosshair.js"> </script>
<script src="/shared/js/graph.js"> </script>

Introduction
------------

After I implemented sockjs-tornado backend, I decided to benchmark it. Luckily, there was good [socket.io performance
test](http://drewww.github.com/socket.io-benchmarking/) out there and I was able to use their test application to benchmark SockJS server performance.

This test will only cover raw messaging performance over Websocket connection(s) for different server implementations of the SockJS protocol. It
won't test any streaming or polling transports.

If you want to bypass full analysis, here is quick summary. On a Core i7-2600K @ 3.4 GHz, using single core, running amd64 linux, I got following results:
* sockjs-node on node 0.6.5 is able to maintain rate of ~45,000 outgoing messages per second
* sockjs-python on CPython 2.6.6 is around of ~55,000 messages per second
* sockjs-python on PyPy 1.7 is in range of 155,000-195,000 messages per second, depending on concurrency level.

Testing Framework
-----------------

Server is a simple broadcast application: whenever client sends a message, it will be echoed to all connected clients. Python server code can be found
[here](https://github.com/MrJoes/sockjs-tornado/blob/master/examples/bench/bench.py). sockjs-node server code is "broadcast" example found in sockjs-node repository with logging disabled.

Client is a little more complicated. It makes a set number of connections to the server (concurrency level), sends a certain number of messages
per second across all clients and measures time that elapses between when the message is sent and when it receives the server-broadcasted version
of this message. If it takes longer than 5 seconds to receive a message, server drops connection or mean response time is greater than 1.5
seconds, server considered overloaded and test will continue with next concurrency level.

Client is written in Java and can be found [here](http://github.com/mrjoes/sock-benchmarking/). At first, I attempted to write one in [Go](http://golang.org/),
but it was not able to keep up with single instance of the sockjs-tornado running on PyPy. Luckily enough, Java version was able to.

Test was executed at a range of concurrency levels (25-2,000) at different messaging rates till server was considered overloaded. At each concurrency
level / messaging rate setting, the client collects various statistics (mean roundtrip time, standard deviation, etc). This data is then used to
plot graphs found in this post.

Hardware and software information
---------------------------------

Linux Meerkat 2.6.32-5-amd64 #1 SMP Thu Nov 3 03:41:26 UTC 2011 x86_64 GNU/Linux

CPU model: Intel(R) Core(TM) i7-2600K CPU @ 3.40GHz

Memory: 16 GB

Server and client were running on the same machine. Client was forced to use 3 cores (out of 4), server was forced to use one core. Client never went above 170% CPU usage,
so it was not CPU limited.

Interpreting results
--------------------

I will quote paragraph from socket.io benchmarking article:

<blockquote>
When looking at these graphs, it's important to remember that any response time greater than 200 ms represents a basically fatal situation; if response times start to rise, it means the task queue on the server has started to receive tasks faster than it can process them. When we hit this state, which I'm calling "jamming", (there may well be some already agreed upon way to describe this state, but I haven't seen it), the server will fall further and further behind and won't be able to recover unless load drops below the jamming threshold and stays below it long enough to clear the backlog. So what we're really interested in here is at what load levels (concurrency level / messaging rate) we start to see slowdown. That will give us a sense of what a maximum safe load level might be. We don't really want to be above that level if we can avoid it, even for short periods of time, because the responsiveness of our application drops substantially.
</blockquote>

Quick edit: it was suggested to use "saturation" instead of "jamming", I will agree here.

Unfortunately, there are no axis labels (if you know how to show them with flot, I will really appreciate it), but it is always time in milliseconds for Y
axis. For X axis it is either messages sent by the client per second or messages received by the client per second.

sockjs-node
-----------

<div id="node_s" class="graph"> </div>
<div id="node_slegend" class="graph_legend"> </div>

<script>
$(function() {
	$.getJSON('/shared/posts/sockjs-bench/node_sent.json', function(data) {
		plotGraph('nodes', '#node_s', '#node_slegend', data, "ne");
	});
});
</script>

On X axis of this graph, we're measuring messages _received_ by the server per second across a range of concurrency levels. Each line is a different
concurrency level. Y axis is mean round-trip time for messages, in milliseconds.

For each concurrency levels, server will have to send more messages as a response to one incoming message, which explains why it takes longer to receive
response for same messaging rates, but different concurrency levels.

Unfortunately, I can't explain spike around 500 ms for concurrency level of 25. I saw similar artifacts for other concurrency levels tests (including
socket.io tests), so I assume it has something to do with garbage collection and nodejs.

Now, lets change X axis to be messages _sent_ by the server:

<div id="node_r" class="graph"> </div>
<div id="node_rlegend" class="graph_legend"> </div>

<script>
$(function() {
	$.getJSON('/shared/posts/sockjs-bench/node_recv.json', function(data) {
		plotGraph('noder', '#node_r', '#node_rlegend', data, "nw");
	});
});
</script>

As you can see, sockjs-node starts to slow down around 45,000 messages.

Another observation: there are additional costs involved to support higher number of connections. Partially it is related to unnecessary json encoding
when sockjs-node server broadcasts the message.

sockjs-tornado on CPython
-------------------------

One thing to mention before going to python results: python implementation was slightly "cheating" when compared to sockjs-node. SockJS requires that all transfers are done using json-encoded messages, so json encoding and decoding speed will affect performance. sockjs-tornado provides handy [function](https://github.com/MrJoes/sockjs-tornado/blob/master/sockjs/tornado/conn.py#L62), which reduces number of json encodes when broadcasting the message. Quite naive optimization,
but it improved performance by ~10% for high concurrency levels.

Also, sockjs-tornado uses optimized version of the _tornado.websocket_ protocol handler. Some minor changes, but they gave approximately 10% performance boost. _simplejson_ was used as a json encoding
library. I will try it with _ujson_ later, as current stable ujson was failing sockjs-protocol tests.

This graph shows number of messages _sent_ by the client:

<div id="cpython_s" class="graph"> </div>
<div id="cpython_slegend" class="graph_legend"> </div>

<script>
$(function() {
	$.getJSON('/shared/posts/sockjs-bench/cpython_sent.json', function(data) {
		plotGraph('cpythons', '#cpython_s', '#cpython_slegend', data, "ne");
	});
});
</script>

Looks very similar to the sockjs-node results, but with random spikes here and there.

Number of messages _received_:

<div id="cpython_r" class="graph"> </div>
<div id="cpython_rlegend" class="graph_legend"> </div>

<script>
$(function() {
	$.getJSON('/shared/posts/sockjs-bench/cpython_recv.json', function(data) {
		plotGraph('cpythonr', '#cpython_r', '#cpython_rlegend', data, "nw");
	});
});
</script>

CPython starts to slow down around 55,000 messages per second. Cost of handling more connections is lower than for sockjs-node (28 ms vs 32 ms at 20,000 mps).


sockjs-tornado on PyPy
----------------------

Now we'll try to run server using pypy 1.7. Built-in json library was used to handle json-related operations.

Number of messages that were _sent_ by the client:

<div id="pypy_s" class="graph"> </div>
<div id="pypy_slegend" class="graph_legend"> </div>

<script>
$(function() {
	$.getJSON('/shared/posts/sockjs-bench/pypy_sent.json', function(data) {
		plotGraph('pypys', '#pypy_s', '#pypy_slegend', data, "ne");
	});
});
</script>

Even with concurrency of 25 clients, PyPy was able to handle around 7,500 messages per second with reasonable (less than 200 ms) mean round-trip time.

Number of messages _received_.

<div id="pypy_r" class="graph"> </div>
<div id="pypy_rlegend" class="graph_legend"> </div>

<script>
$(function() {
	$.getJSON('/shared/posts/sockjs-bench/pypy_recv.json', function(data) {
		plotGraph('pypyr', '#pypy_r', '#pypy_rlegend', data, "nw");
	});
});
</script>

Woohoo, PyPy was able to keep mean response time under 200ms for 150,000 messages. For concurrency level of 200, it was able to pump 195,000 messages in the same time frame.
Costs to keep more connections running is smaller for PyPy as well. At 100,000 messages per second, it took 10ms to get response at highest (2,000) concurrency level.

And for fun - Socket.IO
-----------------------

This is test of the node.js socket.io 0.8.7 server software. I just took existing server application from [here](https://github.com/drewww/socket.io-benchmarking/).

Messages sent:

<div id="socketio_s" class="graph"> </div>
<div id="socketio_slegend" class="graph_legend"> </div>

<script>
$(function() {
	$.getJSON('/shared/posts/sockjs-bench/socketio_sent.json', function(data) {
		plotGraph('socketios', '#socketio_s', '#socketio_slegend', data, "ne");
	});
});
</script>

Graph looks similar to sockjs-node one, but a little bit more spiky.

Messages received:

<div id="socketio_r" class="graph"> </div>
<div id="socketio_rlegend" class="graph_legend"> </div>

<script>
$(function() {
	$.getJSON('/shared/posts/sockjs-bench/socketio_recv.json', function(data) {
		plotGraph('socketior', '#socketio_r', '#socketio_rlegend', data, "nw");
	});
});
</script>

Looks similar to sockjs-node, but with more jitter.

Quick Comparative Analysis
--------------------------

<div id="summary" class="graph"> </div>
<div id="summary_legend" class="graph_legend"> </div>

<script>
$(function() {
	$.getJSON('/shared/posts/sockjs-bench/summary.json', function(data) {
		plotGraph('summary', '#summary', '#summary_legend', data, "ne");
	});
});
</script>

X axis is number of messages _received_.

socket.io and sockjs-node are very close in their performance. CPython is slightly faster and is able to handle increased load more efficiently than node.js servers. PyPy is a clear winner.

Memory usage
------------

With 2000 clients and reasonable rates, approximate memory usage was:
* sockjs-node around 36 MB
* sockjs-tornado on CPython around 52 MB
* sockjs-tornado on PyPy around 100 MB.

Keep in mind, test was executed on 64 bit machine and Python is quite memory hungry on 64 bit architecture (python is all about references), so you might
get different numbers on 32 bit architecture. Node was 64 bit as well.

Just to mention, test client ate around 2.5 GB of memory (6.9 GB virtual) at higher concurrency levels.

Conclusions
-----------

I was quite surprised by the results. I thought node.js and PyPy will share first place, while CPython will be left behind. Also, I did not expect PyPy to
perform _that_ well in this benchmark.

socks-node has reasonable performance of ~45,000 pushed messages per second for all tested concurrency levels. If your application is built on top
of node.js software stack, there's no point to switch to different server implementation. Keep in mind that SockJS was developed with scalability in mind,
so you can throw more sockjs-node instances and load balance them. While socket.io test was done for fun, sockjs-node is in same league as socket.io,
so that's good too.

On other hand, if your application is written in Python (Django anyone?), there is no point to investigate node.js option even with CPython interpreter.
If you want to squeeze every bit of performance you can get at cost of some extra memory used and you don't have any incompatible libraries that you can't
use with PyPy, you should really try PyPy. It is very compatible, production ready and extremely fast.

Unfortunately, I didn't have chance to test other SockJS server implementations (erlang, ruby, vert.x, lua), but you might want to benchmark them as well.

Please keep in mind, this benchmark is purely theoretical, because it is highly unlikely that all your clients will use websocket protocol. SockJS
supports streaming transports (one streaming connection for incoming data, short living AJAX requests for outgoing data), so at least you expect that
your server won't be hit as often as socket.io server.

Thanks
------

I'm really grateful to [Drew Harry](http://web.media.mit.edu/~dharry/), who saved lot of my time by doing his socket.io test.
