use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use solana_program::instruction::{AccountMeta, Instruction};
use solana_program::program::invoke_signed;
use std::str::FromStr;

declare_id!("Eb6tqzqd45Ax4ATKLeE5VNy8K9ppPTEUZujHJFpL7qrZ");

#[program]
pub mod trading_bot {
    use super::*;

    pub fn trade(ctx: Context<Trade>, actions: Vec<TradeAction>, amount: u64) -> Result<()> {
        msg!("Starting transaction for buy/sell actions...");
        msg!("Flashloan Program ID: {:?}", ctx.accounts.flashloan_program.key());
        msg!("Borrower: {:?}", ctx.accounts.borrower.key());
        msg!("Flashloan: {:?}", ctx.accounts.flashloan.key());
        msg!("Amount: {:?}", amount);

        // Execute flashloan logic
        invoke_signed(
            &flashloan_instruction(
                ctx.accounts.flashloan_program.key(),
                ctx.accounts.source_liquidity.key(),
                ctx.accounts.destination_liquidity.key(),
                ctx.accounts.reserve.key(),
                ctx.accounts.lending_market.key(),
                ctx.accounts.lending_market_authority.key(),
                ctx.accounts.token_program.key(),
                amount,
                *ctx.program_id, // Dereference ctx.program_id here
                vec![],
            )?,
            &[
                ctx.accounts.source_liquidity.to_account_info(),
                ctx.accounts.destination_liquidity.to_account_info(),
                ctx.accounts.reserve.to_account_info(),
                ctx.accounts.lending_market.to_account_info(),
                ctx.accounts.lending_market_authority.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.borrower.to_account_info(),
            ],
            &[],
        )?;

        // Emit a FlashloanEvent to track the flashloan
        emit!(FlashloanEvent {
            borrower: ctx.accounts.borrower.key(),
            amount,
        });

        // Execute each trade action in sequence
        for action in actions {
            match action {
                TradeAction::Buy => {
                    msg!("Executing buy transaction...");
                    emit!(TradeActionEvent {
                        action_type: "buy".to_string(),
                    });
                }
                TradeAction::Sell => {
                    msg!("Executing sell transaction...");
                    emit!(TradeActionEvent {
                        action_type: "sell".to_string(),
                    });
                }
            }
        }

        // Repay the flashloan
        msg!("Repaying flashloan...");
        // Implement repayment logic here

        msg!("Transaction completed with flashloan repayment.");
        Ok(())
    }
}

#[account]
pub struct FlashloanAccount {
    pub borrower: Pubkey,
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum TradeAction {
    Buy,
    Sell,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Trade<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: For demonstration purposes.
    pub seller: AccountInfo<'info>,
    /// CHECK: Mutable account for flashloan logic.
    #[account(mut)]
    pub borrower: AccountInfo<'info>,
    #[account(
        init,
        seeds = [b"flashloan-seed"],
        bump,
        payer = buyer,
        space = 8 + 32 + 8
    )]
    pub flashloan: Account<'info, FlashloanAccount>,
    /// CHECK: Solend flashloan program.
    #[account(address = Pubkey::from_str("ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx").unwrap())]
    pub flashloan_program: AccountInfo<'info>,
    /// CHECK: Reserve liquidity supply.
    #[account(mut)]
    pub source_liquidity: AccountInfo<'info>,
    /// CHECK: Destination liquidity (user's token account).
    #[account(mut)]
    pub destination_liquidity: AccountInfo<'info>,
    /// CHECK: Reserve account.
    pub reserve: AccountInfo<'info>,
    /// CHECK: Lending market account.
    pub lending_market: AccountInfo<'info>,
    /// CHECK: Derived lending market authority.
    pub lending_market_authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct TradeActionEvent {
    pub action_type: String,
}

#[event]
pub struct FlashloanEvent {
    pub borrower: Pubkey,
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
struct FlashLoanInstructionData {
    instruction: u8,
    amount: u64,
}

fn flashloan_instruction(
    flashloan_program_id: Pubkey,
    source_liquidity_pubkey: Pubkey,
    destination_liquidity_pubkey: Pubkey,
    reserve_pubkey: Pubkey,
    lending_market_pubkey: Pubkey,
    lending_market_authority_pubkey: Pubkey,
    token_program_id: Pubkey,
    amount: u64,
    flash_loan_receiver_program_id: Pubkey,
    flash_loan_receiver_program_accounts: Vec<AccountMeta>,
) -> Result<Instruction> {
    let data = FlashLoanInstructionData {
        instruction: 9, // FlashLoan instruction code in Solend
        amount,
    }
    .try_to_vec()?; // Serialize the struct

    let mut accounts = vec![
        AccountMeta::new(source_liquidity_pubkey, false),
        AccountMeta::new(destination_liquidity_pubkey, true),
        AccountMeta::new(reserve_pubkey, false),
        AccountMeta::new(lending_market_pubkey, false),
        AccountMeta::new_readonly(lending_market_authority_pubkey, false),
        AccountMeta::new_readonly(token_program_id, false),
        AccountMeta::new_readonly(flash_loan_receiver_program_id, false),
    ];

    accounts.extend(flash_loan_receiver_program_accounts);

    Ok(Instruction {
        program_id: flashloan_program_id,
        accounts,
        data,
    })
}