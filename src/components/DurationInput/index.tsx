import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/16/solid";
import { useRef } from "preact/hooks";
import "./style.css";

interface NumberInputProps {
	start: number;
	label: string;
	lowerBound?: number;
	upperBound?: number;
	onChange?: (n: number) => void;
}

const NumberInput = ({ start, label, lowerBound, upperBound, onChange }: NumberInputProps) => {
	const inputRef = useRef<HTMLInputElement>();

	const changeCurrent = (delta: number) => {
		setBoundedCurrent(start + delta);
	};

	const setBoundedCurrent = (n: number) => {
		if (n > upperBound) {
			n = upperBound;
		}

		if (n < lowerBound) {
			n = lowerBound;
		}

		onChange(n);
	};

	const onType = () => {
		inputRef.current.value = inputRef.current.value.replace(/[^0-9]/, "");
		if (inputRef.current.value === "") {
			inputRef.current.value = "0";
		}

		setBoundedCurrent(parseInt(inputRef.current.value));
	};

	return (
		<span class="flex flex-row pr-4">
			<span class="flex flex-col">
				<button class="w-full h-6 flex flex-row justify-center" onClick={() => changeCurrent(1)}>
					<ChevronUpIcon class="inline size-6 self-center" />
				</button>
				<span class="border-solid border-2 rounded duration-box-container">
					<input
						type="text"
						inputmode="numeric"
						class="w-20 text-center bg-transparent txt-box focus:outline-none"
						value={start.toString()}
						ref={inputRef}
						onChange={onType}
					/>
				</span>
				<button class="w-full h-6 flex flex-row justify-center" onClick={() => changeCurrent(-1)}>
					<ChevronDownIcon class="inline size-6 self-center" />
				</button>
			</span>
			<span class="self-center pl-2">{label}</span>
		</span>
	);
};

// Parse a duration from 1d2h3m into {'d': 1, 'h': 2, 'm': 3}
export const parseDurationIntoComponents = (duration: string) => {
	let currentNumber = "";
	const mapping = {};
	for (let i = 0; i < duration.length; i++) {
		if (duration[i] >= "0" && duration[i] <= "9") {
			currentNumber += duration[i];
			continue;
		}

		if (currentNumber != "") {
			mapping[duration[i]] = parseInt(currentNumber);
			currentNumber = "";
		} else {
			throw `Empty duration for ${duration[i]}`;
		}
	}

	return mapping;
};

interface DurationInputProps {
	duration: string;
	onChange(duration: string): void;
}

export default ({ onChange, duration }: DurationInputProps) => {
	const callChange = (day: number, hour: number, minute: number) => {
		if (day == 0 && hour == 0 && minute === 0) {
			minute = 1;
		}

		onChange(`${day}d${hour}h${minute}m`);
	};

	let durationComponents: Record<string, number>;

	try {
		durationComponents = parseDurationIntoComponents(duration);
	} catch (e) {
		console.log(e);
		durationComponents = { d: 0, h: 1, m: 0 };
	}

	const day = durationComponents["d"] ?? 0;
	const hour = durationComponents["h"] ?? 0;
	const minute = durationComponents["m"] ?? 0;

	// If day and hour are 0, minute must be at least 1.
	const minuteLowerBound = day === 0 && hour === 0 ? 1 : 0;
	if (day === 0 && hour === 0 && minute === 0) {
		callChange(day, hour, 1);
	}

	return (
		<span class="flex flex-row">
			<NumberInput
				start={day}
				label="Day"
				lowerBound={0}
				onChange={(n) => {
					callChange(n, hour, minute);
				}}
			/>
			<NumberInput
				start={hour}
				label="Hour"
				lowerBound={0}
				onChange={(n) => {
					callChange(day, n, minute);
				}}
			/>
			<NumberInput
				start={minute}
				label="Minute"
				lowerBound={minuteLowerBound}
				onChange={(n) => {
					callChange(day, hour, n);
				}}
			/>
		</span>
	);
};
