import { useAtom } from 'jotai'
import { useEffect } from 'react'
import { isCloudServiceEnabled, isLocalDirectorySelectorEnabled } from '../../../../../core'
import { SpatialNavigation } from '../../../../lib/spatial-navigation'
import { BaseButton } from '../../../primitives/base-button'
import { BaseDialogContent } from '../../../primitives/base-dialog-content'
import { BasePopover } from '../../../primitives/base-popover'
import { isInvalidDialogOpenAtom } from './atoms'
import { DirectoryInstruction } from './directory-instruction'
import { DropboxButton } from './dropbox-button'
import { GoogleDriveButton } from './google-drive-button'
import { LocalButton } from './local-button'
import { OnedriveButton } from './onedrive-button'

const isOnedriveEnabled = isCloudServiceEnabled('onedrive')
const isGoogleDriveEnabled = isCloudServiceEnabled('google-drive')
const isDropboxEnabled = isCloudServiceEnabled('dropbox')
const isAnyCloudServiceEnabled = isOnedriveEnabled || isGoogleDriveEnabled

const directoryInstruction = <DirectoryInstruction />
const directoryInstructionToolTip = (
  <BasePopover
    tooltipContent={
      <div className='max-w-[320px]'>
        <div className='rounded border border-rose-700 bg-white p-6 text-rose-700'>{directoryInstruction}</div>
      </div>
    }
  >
    <span className='icon-[mdi--help-circle-outline] relative -top-1 h-4 w-4' />
  </BasePopover>
)

export function ContinueModalContent() {
  const [isInvalidDialogOpen, setIsInvalidDialogOpenAtom] = useAtom(isInvalidDialogOpenAtom)

  useEffect(() => {
    SpatialNavigation.focus()
  }, [])

  return (
    <div className='get-started container m-auto flex max-w-5xl flex-col px-4 text-rose-700'>
      <div className='get-started-content w-full rounded-xl'>
        <div className='flex flex-col items-center gap-6'>
          {isAnyCloudServiceEnabled ? (
            <div className='flex flex-col items-center'>
              <div className='flex-center gap-2 text-center font-bold'>
                <span className='icon-[mdi--cube-outline] h-6 w-6' />
                Select a cloud directory
                {directoryInstructionToolTip}
              </div>
              <div className='mt-2 flex items-start justify-center text-xs'>
                <span className='icon-[mdi--thumb-up] mr-2 mt-1 h-3 w-3' />
                <div>Synchronize your games and saves across multiple devices.</div>
              </div>
              <div className='mt-4 flex w-60 flex-col justify-between gap-y-3'>
                {isOnedriveEnabled ? <OnedriveButton /> : null}
                {isGoogleDriveEnabled ? <GoogleDriveButton /> : null}
                {isDropboxEnabled ? <DropboxButton /> : null}
              </div>
            </div>
          ) : null}

          {isLocalDirectorySelectorEnabled() ? (
            <div>
              <div className='flex-center gap-2 text-center font-bold'>
                <span className='icon-[mdi--cube-outline] h-6 w-6' />
                Select a local directory
                {directoryInstructionToolTip}
              </div>
              <div className='mt-4 flex justify-center'>
                <LocalButton />
              </div>
            </div>
          ) : null}
        </div>

        <div className='m-auto mt-10 px-12 text-rose-200' hidden>
          <div className='flex items-center font-bold'>
            <span className='icon-[mdi--bell] mr-2 h-4 w-4' />
            Notice:
          </div>
          <div className='mt-2 pl-6'>
            The directory you choose should match a certain structure:
            <br />
            The ROMs of retro games should be grouped in seperate directories, and the directories should be named in
            these conviention:
            <ul className='list-disc pl-4'>
              <li className='list-item'>NES/Famicom - nes</li>
              <li className='list-item'>SNES/Super Famicom - snes</li>
            </ul>
          </div>
        </div>
      </div>
      <BaseDialogContent closable onOpenChange={setIsInvalidDialogOpenAtom} open={isInvalidDialogOpen}>
        <div className='max-w-lg text-rose-700'>
          <div className='flex items-center font-bold'>
            <span className='icon-[mdi--alert] mr-2 h-5 w-5 shrink-0 text-yellow-400' />
            <h4>You selected an invalid directory as your ROMs directory</h4>
          </div>

          <div className='mt-4'>
            <DirectoryInstruction />
          </div>

          <div className='mt-4 text-center'>
            <BaseButton className='m-auto' onClick={() => setIsInvalidDialogOpenAtom(false)} styleType='primary'>
              <span className='icon-[mdi--hand-okay] h-5 w-5' />
              OK
            </BaseButton>
          </div>
        </div>
      </BaseDialogContent>
    </div>
  )
}
