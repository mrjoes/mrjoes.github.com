---
layout: post
title: SockJS vs BOSH
abstract: SockJS vs BOSH latency tests
---

Last few days I spent integrating SockJS transport library into Ejabberd and Strophe. And here are some thoughts and impressions.

Just in case:
1. [Ejabberd](http://www.ejabberd.im/) is XMPP (Jabber) server written in Erlang;
2. BOSH is "Bidirectional-streams Over Synchronous HTTP", basically custom protocol over HTTP which allows browsers to talk to XMPP server. Defined [here](http://xmpp.org/extensions/xep-0206.html);
3. [Strophe](http://strophe.im/) is XMPP protocol library written in JavaScript;
4. [SockJS](http://sockjs.org/) is websocket emulation protocol. It works over real websockets if there's browser support or uses one of the fallback transports (long polling, etc).

Why SockJS?
-----------

Actually, it is better to rephrase the question: why websockets? Because of latency and cost to maintain active connection. It is much more efficient
to use persistent TCP connection than bunch of short-lived HTTP requests.

Why SockJS instead of raw websockets and BOSH as fallback? Three reasons:

1. SockJS provides websocket-like API, so using SockJS on the client is as simple as creating instance of SockJS class instead of Websocket class;
2. No need to hack Strophe to support both BOSH and websocket at the same time - SockJS already provides fallback transports;
3. There are ready-to-use server-side websocket libraries for Erlang (like [Cowboy](https://github.com/extend/cowboy)). Instead of writing yet
   another websocket protocol implementation using Ejabberd HTTP framework, I thought it should be easier to run Cowboy in a separate
   Erlang process and use its websocket module. With this in mind, why not use [sockjs-erlang](https://github.com/sockjs/sockjs-erlang),
   as it already runs on top of Cowboy?

Protocol
--------

Instead of using custom handshake (like in BOSH), client sends and receives "normal" XMPP stream header. SockJS connection is just replacement of the raw TCP connection with exactly same protocol.

Ejabberd integration
--------------------

Unfortunately, there's no ready-to-use websocket module for Ejabberd. There's pretty old fork, which you can find [here](https://github.com/superfeedr/ejabberd-websockets).
Unfortunately, it is quite hackish (parsing XML with regexps, creating new process for each incoming stanza, etc) and does not support latest websocket spec.

There's supposedly websocket module developed by ProcessOne, but it is not released, so I can't say anything about it.

SockJS integration module was developed as ordinary Ejabberd module, which spawns worker process, which hosts Cowboy with SockJS route.
For every incoming SockJS connection, it spawns child process which holds some state, xml_stream and child c2s connection.
Whenever something received from the SockJS, it will be fed to the xml_stream. Whenever c2s wants to send something, it will be sent
using SockJS API, etc.

Unfortunately, I can not share code, but if you want to do integration yourself - it is fairly easy to do.

Strophe.js integration
----------------------

I used this [gist](https://gist.github.com/739147) as basis for the Strophe.js integration. Essentially, it is same Strophe.Connection class as
this in gist, but I used slightly newer Strophe.js version and used SockJS class instead of Websocket class.

Latency tests
-------------

After trying out this integration, I saw significant latency improvement when using websocket transport. But what struck me as well - even
with SockJS polling transports, it seemed like latency is lower than BOSH!

So, I created small HTML page, which does following:

1. Gets current time stamp
2. Connects to jabber server and authenticates
3. Sends ping
4. Waits for pong
5. Repeats step #3 one hundred times
6. Calculates time delta

Basically, it won't send next ping before receiving pong. Higher latency - longer it'll take to complete.

Test results
------------

Legend:

* Transport is SockJS transport name or BOSH if it is BOSH;
* Localhost N - tests against Ejabberd running on localhost, in milliseconds;
* Remote N - tests against US server (average ping at time of testing: 162ms), in milliseconds.


Results:

<style type="text/css">
table, th, td {
    border: 1px solid;
    border-collapse: collapse;
}
</style>
<table>
    <tr>
        <th>Transport</th>
        <th>Localhost 1</th>
        <th>Localhost 2</th>
        <th>Localhost 3</th>
        <th>Remote 1</th>
        <th>Remote 2</th>
        <th>Remote 3</th>
    </tr>
    <tr>
        <td>websocket</td>
        <td>98</td>
        <td>101</td>
        <td>104</td>
        <td>19126</td>
        <td>18418</td>
        <td>19478</td>
    </tr>
    <tr>
        <td>xhr-streaming</td>
        <td>3190</td>
        <td>3193</td>
        <td>3173</td>
        <td>24270</td>
        <td>23753</td>
        <td>24071</td>
    </tr>
    <tr>
        <td>xhr-polling</td>
        <td>3181</td>
        <td>3184</td>
        <td>3192</td>
        <td>37980</td>
        <td>37750</td>
        <td>37811</td>
    </tr>
    <tr>
        <td>jsonp-polling</td>
        <td>10884</td>
        <td>10407</td>
        <td>10522</td>
        <td>42173</td>
        <td>43012</td>
        <td>42771</td>
    </tr>
    <tr>
        <td>BOSH</td>
        <td>21471</td>
        <td>21495</td>
        <td>21503</td>
        <td>47905</td>
        <td>48331</td>
        <td>48122</td>
    </tr>
</table>

Quick analysis
--------------

1. Looks like Ejabberd BOSH implementation agressively buffers outgoing messages to send them in one response. SockJS also does this for polling transports, but doesn't have any internal delays - if there's data in queue, if will be dumped immediately.
2. For remote Ejabberd instance with pretty high network latency results are still in favor of SockJS, even though SockJS did 223 requests for polling
transport and BOSH did only 118;
3. SockJS streaming transport worked very good in this test, very close to websocket performance against remote server;
4. JSONP-polling transport worked as a decent alternative for BOSH;
5. Some transports "scale" better with higher latency. For example, even though xhr-polling and xhr-streaming had same latency against local server,
with remote server xhr-streaming is much more efficient.


Conclusion
----------

I'm pretty happy with the switch. Not sure how sockjs-erlang will handle increased load or what's memory footprint is like, but I'm already
seeing much better application responsiveness with SockJS.

We'll see how it goes.
