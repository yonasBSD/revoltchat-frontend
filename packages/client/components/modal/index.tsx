import {
  For,
  JSXElement,
  createContext,
  createEffect,
  useContext,
} from "solid-js";
import { SetStoreFunction, createStore } from "solid-js/store";

import type { MFA, MFATicket } from "revolt.js";

import { registerController } from "@revolt/common";

import {
  registerKeybindWithPriority,
  unregisterKeybindWithPriority,
} from "../../src/shared/lib/priorityKeybind";
import "../ui/styled.d.ts";

import { RenderModal } from "./modals";
import { Modals } from "./types";

export type ActiveModal = {
  /**
   * Unique modal Id
   */
  id: string;

  /**
   * Whether to show the modal
   */
  show: boolean;

  /**
   * Props to pass to modal
   */
  props: Modals;
};

/**
 * Global modal controller for layering and displaying one or more modal to the user
 */
export class ModalController {
  modals: ActiveModal[];
  setModals: SetStoreFunction<ActiveModal[]>;

  /**
   * Construct controller
   */
  constructor() {
    const [modals, setModals] = createStore<ActiveModal[]>([]);
    // eslint-disable-next-line solid/reactivity
    this.modals = modals;
    this.setModals = setModals;

    this.openModal = this.openModal.bind(this);
    this.pop = this.pop.bind(this);
    this.remove = this.remove.bind(this);
    this.isOpen = this.isOpen.bind(this);
  }

  /**
   * Add a modal to the stack
   * @param props Modal parameters
   */
  openModal(props: Modals) {
    const id = Math.random().toString();
    this.setModals((modals) => [
      ...modals,
      {
        // just need something unique
        id,
        show: true,
        props,
      },
    ]);

    // after modal commits to DOM,
    // we can begin animations!
    // setTimeout(
    //   () =>
    //     this.setModals((modals) =>
    //       modals.map((modal) =>
    //         modal.id === id ? { ...modal, show: true } : modal,
    //       ),
    //     ),
    //   0,
    // );
  }

  /**
   * Remove the top modal
   */
  pop() {
    const modal = [...this.modals].reverse().find((modal) => modal.show);

    if (modal) {
      this.remove(modal.id);
    }
  }

  /**
   * Close modal by id
   */
  remove(id: string) {
    this.setModals((entry) => entry.id === id, "show", false);

    setTimeout(() => {
      this.setModals(this.modals.filter((entry) => entry.id !== id));
    }, 500); /** FIXME / TODO: set to motion anim time + 100ms */
  }

  /**
   * Whether a modal is currently open
   * @returns Boolean
   */
  isOpen() {
    return !!this.modals.find((x) => x.show);
  }
}

/**
 * Modal controller with additional helpers.
 */
export class ModalControllerExtended extends ModalController {
  /**
   * Construct controller
   */
  constructor() {
    super();
    registerController("modal", this);

    this.mfaFlow = this.mfaFlow.bind(this);
    this.mfaEnableTOTP = this.mfaEnableTOTP.bind(this);
    this.openLink = this.openLink.bind(this);
  }

  /**
   * Perform MFA flow
   * @param mfa MFA helper
   */
  mfaFlow(mfa: MFA) {
    return new Promise((callback: (ticket?: MFATicket) => void) =>
      this.openModal({
        type: "mfa_flow",
        state: "known",
        mfa,
        callback,
      }),
    );
  }

  /**
   * Open TOTP secret modal
   * @param client Client
   */
  mfaEnableTOTP(secret: string, identifier: string) {
    return new Promise((callback: (value?: string) => void) =>
      this.openModal({
        type: "mfa_enable_totp",
        identifier,
        secret,
        callback,
      }),
    );
  }

  /**
   * Write text to the clipboard
   * @param text Text to write
   * @deprecated use navigator clipboard directly
   */
  writeText(text: string) {
    navigator.clipboard.writeText(text);
  }

  /**
   * Safely open external or internal link
   * @param href Raw URL
   * @param trusted Whether we trust this link
   * @returns Whether to cancel default event
   */
  openLink(/*href?: string, trusted?: boolean*/) {
    /*const link = determineLink(href);
    const settings = getApplicationState().settings;

    switch (link.type) {
      case "navigate": {
        history.push(link.path);
        break;
      }
      case "external": {
        if (!trusted && !settings.security.isTrustedOrigin(link.url.hostname)) {
          modalController.push({
            type: "link_warning",
            link: link.href,
            callback: () => this.openLink(href, true) as true,
          });
        } else {
          window.open(link.href, "_blank", "noreferrer");
        }
      }
    }*/

    return true;
  }
}

/**
 * @deprecated use the context API instead, useModals
 */
export const modalController = new ModalControllerExtended();

const ModalControllerContext = createContext<ModalControllerExtended>(
  null as unknown as ModalControllerExtended,
);

/**
 * Mount the modal controller
 */
export function ModalContext(props: { children: JSXElement }) {
  const controller = new ModalControllerExtended();

  return (
    <ModalControllerContext.Provider value={controller}>
      {props.children}
    </ModalControllerContext.Provider>
  );
}

/**
 * Use the modal controller
 */
export function useModals() {
  return useContext(ModalControllerContext);
}

/**
 * Render modals
 */
export function ModalRenderer() {
  const modalController = useModals();

  createEffect(() => {
    /**
     * Handle key press
     * @param event Event
     */
    function keyDown(event: KeyboardEvent) {
      event.stopPropagation();
      modalController.pop();
    }

    if (modalController.modals.length === 0)
      return unregisterKeybindWithPriority(keyDown);

    return registerKeybindWithPriority("Escape", keyDown, 1, "user-visible");
  });

  createEffect(() => {
    console.info(
      "[DEBUG] (2) Modal render targets updated:",
      modalController.modals,
    );
  });

  return (
    <For each={modalController.modals}>
      {(entry) => (
        <RenderModal
          {...entry}
          onClose={() => modalController.remove(entry.id)}
        />
      )}
    </For>
  );
}
