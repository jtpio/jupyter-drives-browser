import {
  ILabShell,
  JupyterFrontEndPlugin,
  IRouter,
  JupyterFrontEnd
} from '@jupyterlab/application';
import {
  IDefaultFileBrowser,
  IFileBrowserFactory,
  FileBrowser
} from '@jupyterlab/filebrowser';
import { IDocumentManager } from '@jupyterlab/docmanager';
import {
  createToolbarFactory,
  IToolbarWidgetRegistry,
  setToolbar
} from '@jupyterlab/apputils';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator } from '@jupyterlab/translation';

import { CommandRegistry } from '@lumino/commands';

import { Drive } from './contents';
// import { DriveIcon } from './icons';

import driveSvg from '../style/driveIconFileBrowser.svg';
import { folderIcon } from '@jupyterlab/ui-components';

/**
 * The command IDs used to the filebrowser plugin.
 */
namespace CommandIDs {
  export const openPath = 'filebrowser:open-path';
}

const FILE_BROWSER_FACTORY = 'FileBrowser';
const FILE_BROWSER_PLUGIN_ID = 'jupyter-drives-browser:file-browser-toolbar';

// create S3 drive for test purposes
const test_drive = new Drive();
test_drive.name = 'S3TestDrive';

/**
 * The default file browser factory provider.
 */
export const defaultFileBrowser: JupyterFrontEndPlugin<IDefaultFileBrowser> = {
  id: 'drives-browser:default-file-browser',
  description: 'The default file browser factory provider',
  provides: IDefaultFileBrowser,
  requires: [IDocumentManager, IFileBrowserFactory],
  optional: [IRouter, JupyterFrontEnd.ITreeResolver, ILabShell],
  activate: async (
    app: JupyterFrontEnd,
    drive: Drive,
    fileBrowserFactory: IFileBrowserFactory,
    router: IRouter | null,
    tree: JupyterFrontEnd.ITreeResolver | null,
    labShell: ILabShell | null
  ): Promise<IDefaultFileBrowser> => {
    const { commands } = app;

    // manager.services.contents.addDrive(test_drive);
    app.serviceManager.contents.addDrive(test_drive);

    // Manually restore and load the default file browser.
    const defaultBrowser = fileBrowserFactory.createFileBrowser('filebrowser', {
      auto: false,
      restore: false,
      driveName: drive.name
    });
    void Private.restoreBrowser(
      defaultBrowser,
      commands,
      router,
      tree,
      labShell
    );

    // Override folder icon with the drive one - temporary
    folderIcon.svgstr = driveSvg;

    // add lines from browser widget plugin to define attributes

    return defaultBrowser;
  }
};

export const toolbarFileBrowser: JupyterFrontEndPlugin<void> = {
  id: 'jupyter-drives-browser:file-browser-toolbar',
  description: 'The toolbar for the drives file browser',
  requires: [IDefaultFileBrowser, IToolbarWidgetRegistry, ISettingRegistry],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    fileBrowser: IDefaultFileBrowser,
    toolbarRegistry: IToolbarWidgetRegistry,
    settingsRegistry: ISettingRegistry,
    translator: ITranslator,
    fileBrowserCommands: null
  ): Promise<void> => {
    // const { commands } = app;
    console.log('file-browser-toolbar pluging activated!');

    // toolbarRegistry.addFactory(
    //     FILE_BROWSER_FACTORY,
    //     'uploaderTest',
    //     (fileBrowser: FileBrowser) =>
    //       new Uploader({ model: fileBrowser.model, translator })
    //   );

    // toolbarRegistry.addFactory(
    //   FILE_BROWSER_FACTORY,
    //   'fileNameSearcherTest',
    //   (fileBrowser: FileBrowser) => {
    //     const searcher = FilenameSearcher({
    //       updateFilter: (
    //         filterFn: (item: string) => Partial<IScore> | null,
    //         query?: string
    //       ) => {
    //         fileBrowser.model.setFilter(value => {
    //           return filterFn(value.name.toLowerCase());
    //         });
    //       },
    //       useFuzzyFilter: true,
    //       placeholder: 'Filter files by namesss',
    //       forceRefresh: true
    //     });
    //     searcher.addClass(FILTERBOX_CLASS);
    //     return searcher;
    //   }
    // );

    // connect the filebrowser toolbar to the settings registry for the plugin
    setToolbar(
      fileBrowser,
      createToolbarFactory(
        toolbarRegistry,
        settingsRegistry,
        FILE_BROWSER_FACTORY,
        FILE_BROWSER_PLUGIN_ID,
        translator
      )
    );
  }
};

namespace Private {
  /**
   * Restores file browser state and overrides state if tree resolver resolves.
   */
  export async function restoreBrowser(
    browser: FileBrowser,
    commands: CommandRegistry,
    router: IRouter | null,
    tree: JupyterFrontEnd.ITreeResolver | null,
    labShell: ILabShell | null
  ): Promise<void> {
    const restoring = 'jp-mod-restoring';

    browser.addClass(restoring);

    if (!router) {
      await browser.model.restore(browser.id);
      await browser.model.refresh();
      browser.removeClass(restoring);
      return;
    }

    const listener = async () => {
      router.routed.disconnect(listener);

      const paths = await tree?.paths;
      if (paths?.file || paths?.browser) {
        // Restore the model without populating it.
        await browser.model.restore(browser.id, false);
        if (paths.file) {
          await commands.execute(CommandIDs.openPath, {
            path: paths.file,
            dontShowBrowser: true
          });
        }
        if (paths.browser) {
          await commands.execute(CommandIDs.openPath, {
            path: paths.browser,
            dontShowBrowser: true
          });
        }
      } else {
        await browser.model.restore(browser.id);
        await browser.model.refresh();
      }
      browser.removeClass(restoring);

      if (labShell?.isEmpty('main')) {
        void commands.execute('launcher:create');
      }
    };
    router.routed.connect(listener);
  }
}
