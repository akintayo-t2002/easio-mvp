import * as Dialog from '@radix-ui/react-dialog';
import React, { useEffect } from 'react';

import {
	LiveKitRoom,
	RoomAudioRenderer,
	StartAudio,
} from '@livekit/components-react';
import { X } from 'lucide-react';

import { useTestSession } from '../../hooks/useTestSession';
import LoadingSpinner from '../LoadingSpinner';
import { Button } from '../ui/button';
import { ChatPanel } from './ChatPanel';

interface TestChatModalProps {
	open: boolean;
	onClose: () => void;
	workflowName?: string | null;
	workflowVersionId: string | null;
}

export const TestChatModal: React.FC<TestChatModalProps> = ({
	open,
	onClose,
	workflowName,
	workflowVersionId,
}) => {
	const { status, session, shouldConnect, error, start, stop } =
		useTestSession();

	useEffect(() => {
		if (open && workflowVersionId) {
			if (status === 'idle' || status === 'error') {
				void start(workflowVersionId);
			}
		} else {
			stop();
		}
	}, [open, workflowVersionId, start, stop, status]);

	useEffect(() => {
		if (!open) {
			stop();
		}
	}, [open, stop]);

	const canSend = status === 'ready' && !!session;

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(value) => !value && onClose()}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
				<Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
					<div className="flex h-full max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
						<header className="flex items-center justify-between border-b border-border px-6 py-4">
							<div>
								<h2 className="text-lg font-semibold text-text-primary">
									Test workflow
								</h2>
								<p className="text-sm text-text-secondary">
									{workflowName ?? 'Unnamed workflow'}
								</p>
							</div>
							<Dialog.Close asChild>
								<button
									onClick={() => {
										stop();
										onClose();
									}}
									className="rounded-md p-2 transition-colors hover:bg-background-secondary">
									<X className="h-5 w-5 text-text-secondary" />
								</button>
							</Dialog.Close>
						</header>

						<main className="flex flex-1 overflow-hidden bg-background-secondary/30">
							{!workflowVersionId ? (
								<div className="flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-text-secondary">
									<p>
										Select or create a workflow version before starting a test
										session.
									</p>
									<Button
										onClick={onClose}
										variant="outline">
										Close
									</Button>
								</div>
							) : status === 'starting' ? (
								<div className="flex h-full w-full items-center justify-center">
									<LoadingSpinner
										message="Connecting to LiveKit…"
										size="lg"
									/>
								</div>
							) : error ? (
								<div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
									<div className="space-y-2">
										<p className="text-base font-medium text-text-primary">
											Unable to start test session
										</p>
										<p className="text-sm text-text-secondary">{error}</p>
									</div>
									<div className="flex gap-2">
										<Button
											variant="outline"
											onClick={() => {
												stop();
												onClose();
											}}>
											Cancel
										</Button>
										<Button
											onClick={() => {
												if (workflowVersionId) {
													void start(workflowVersionId);
												}
											}}>
											Retry
										</Button>
									</div>
								</div>
							) : session ? (
								<LiveKitRoom
									data-lk-theme="default"
									serverUrl={session.room_url}
									token={session.token}
									connect={shouldConnect}
									className="flex h-full w-full">
									<div className="flex h-full w-full flex-col">
										<ChatPanel
											accentColorClass="text-blue-600"
											canSend={canSend}
											//could break
											isConnecting={status === 'starting'}
										/>
										<RoomAudioRenderer />
										<StartAudio label="Enable audio playback" />
									</div>
								</LiveKitRoom>
							) : (
								<div className="flex h-full w-full items-center justify-center">
									<LoadingSpinner
										message="Preparing session…"
										size="md"
									/>
								</div>
							)}
						</main>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
};
