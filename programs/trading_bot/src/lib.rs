use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use solana_program::instruction::Instruction;
use solana_program::program::invoke_signed;
use std::str::FromStr;

declare_id!("2hauxGhmk9heVJV6a7XN9kzj2CzckVjvhVrij595C4Su");

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
                ctx.accounts.borrower.key(),
                ctx.accounts.flashloan.key(),
                amount,
            )?,
            &[
                ctx.accounts.flashloan_program.to_account_info(),
                ctx.accounts.borrower.to_account_info(),
                ctx.accounts.flashloan.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
            &[&[b"flashloan-seed", &[ctx.bumps.flashloan]]],
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
        invoke_signed(
            &repay_flashloan_instruction(
                ctx.accounts.flashloan_program.key(),
                ctx.accounts.borrower.key(),
                ctx.accounts.flashloan.key(),
                amount,
            )?,
            &[
                ctx.accounts.flashloan_program.to_account_info(),
                ctx.accounts.borrower.to_account_info(),
                ctx.accounts.flashloan.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
            &[&[b"flashloan-seed", &[ctx.bumps.flashloan]]],
        )?;

        msg!("Transaction completed with flashloan repayment.");
        Ok(())
    }
}

// Define the structure for storing account data
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
    /// CHECK: This is a simple account with no need for verification as it’s used only for demonstration.
    pub seller: AccountInfo<'info>,
    /// CHECK: This account is the borrower and is mutable because it handles flashloan logic.
    #[account(mut)]
    pub borrower: AccountInfo<'info>,
    /// CHECK: This account will handle the flashloan.
    #[account(
        init,
        seeds = [b"flashloan-seed"],
        bump,
        payer = buyer,
        space = 8 + 32 + 8 // 8 bytes for the discriminator, 32 bytes for borrower pubkey, 8 bytes for amount
    )]
    pub flashloan: Account<'info, FlashloanAccount>,
    /// CHECK: This is the Solend flashloan program.
    #[account(address = Pubkey::from_str("ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx").unwrap())]
    pub flashloan_program: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}


// Flashloan instruction construction
fn flashloan_instruction(
    flashloan_program_id: Pubkey,
    borrower: Pubkey,
    flashloan: Pubkey,
    amount: u64,
) -> Result<Instruction> {
    #[derive(AnchorSerialize, AnchorDeserialize)]
    struct FlashLoanInstructionData {
        amount: u64,
    }

    let data = FlashLoanInstructionData { amount }.try_to_vec()?;
    let accounts = vec![
        AccountMeta::new_readonly(borrower, true),
        AccountMeta::new(flashloan, false),
    ];

    Ok(Instruction {
        program_id: flashloan_program_id,
        accounts,
        data,
    })
}

// Repay flashloan instruction construction
fn repay_flashloan_instruction(
    flashloan_program_id: Pubkey,
    borrower: Pubkey,
    flashloan: Pubkey,
    amount: u64,
) -> Result<Instruction> {
    #[derive(AnchorSerialize, AnchorDeserialize)]
    struct RepayLoanInstructionData {
        amount: u64,
    }

    // Assume repayment with an additional 1% fee
    let repay_amount = amount + (amount / 100);
    let data = RepayLoanInstructionData { amount: repay_amount }.try_to_vec()?;
    let accounts = vec![
        AccountMeta::new_readonly(borrower, true),
        AccountMeta::new(flashloan, false),
    ];

    Ok(Instruction {
        program_id: flashloan_program_id,
        accounts,
        data,
    })
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