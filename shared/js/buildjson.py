import csv
import json

if __name__ == '__main__':
	sent = dict()
	recv = dict()

	data = csv.reader(open('data.log', 'rb'), delimiter=',')
	for row in data:
		int concurrency = int(row[0])
		float rate = float(row[1])
		float mean = float(row[4])

		if concurrency not in sent:
			sent[concurrency] = []
			recv[concurrency] = []

		sent[concurrency].append([rate, mean])
		recv[concurrency].append([concurrency*rate, mean])

	file('sent.json', 'wb').write(json.dumps(sent))
	file('recv.json', 'wb').write(json.dumps(recv))
